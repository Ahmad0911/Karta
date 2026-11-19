import { createHmac } from 'node:crypto'

import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId, randomToken, safeEqual } from '../../platform/crypto.ts'
import { get, run, tx } from '../../platform/db.ts'
import { AppError, conflict, notFound, tooMany, unauthorized, unprocessable } from '../../platform/errors.ts'
import { requireAuth, staffOnly, type Router } from '../../platform/http.ts'
import { PaystackError } from '../../platform/paystack.ts'
import { int, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { settle, type PaymentRow } from './service.ts'

export function paymentRoutes(router: Router, deps: Deps) {
  const { db, clock, config, limiter, log } = deps

  const needPaystack = () => {
    if (!deps.paystack) throw new AppError(503, 'payments_unavailable', 'Online payment isn’t available yet. Please try again later.')
    return deps.paystack
  }
  const isStaff = (role: string) => role === 'admin' || role === 'super_admin'
  const paystackFailure = (e: unknown): never => {
    if (e instanceof PaystackError) throw new AppError(502, 'payment_provider_error', 'We couldn’t reach the payment service. Please try again.')
    throw e
  }

  /** The customer is sent to Paystack's hosted page. The AMOUNT is the order total the server already computed. */
  router.post('/api/payments/initialize', requireAuth, async (ctx) => {
    const user = ctx.user!
    const body = parse({ orderId: str({ min: 1, max: 64 }), returnUrl: str({ min: 8, max: 500 }) }, ctx.body)
    const paystack = needPaystack()

    // Only send people back to our own site (blocks open-redirect tricks).
    let origin: string
    try { origin = new URL(body.returnUrl).origin } catch { throw unprocessable('returnUrl', 'Invalid return address.') }
    if (!config.corsOrigins.includes(origin)) throw unprocessable('returnUrl', 'Invalid return address.')

    const wait = limiter.check(`pay-init:${user.id}`, 10, 60_000)
    if (wait) throw tooMany(wait)

    const order = get<{ id: string; customer_id: string; status: string; total_kobo: number }>(db, 'SELECT id,customer_id,status,total_kobo FROM orders WHERE id = ?', body.orderId)
    if (!order || order.customer_id !== user.id) throw notFound('Order not found.')
    if (order.status !== 'awaiting_payment') throw conflict('order_not_payable', 'This order has already been paid or closed.')

    const reference = `KRT-${randomToken(15).replace(/[-_]/g, 'x')}`
    run(db, "INSERT INTO payments (reference,order_id,provider,amount_kobo,status,created_at) VALUES (?,?,?,?,'pending',?)", reference, order.id, 'paystack', order.total_kobo, iso(clock.now()))

    try {
      const sep = body.returnUrl.includes('?') ? '&' : '?'
      const s = await paystack.initialize({ email: user.email, amountKobo: order.total_kobo, reference, callbackUrl: `${body.returnUrl}${sep}reference=${encodeURIComponent(reference)}` })
      return { reference, checkoutUrl: s.authorizationUrl }
    } catch (e) {
      run(db, "UPDATE payments SET status = 'failed' WHERE reference = ?", reference)
      return paystackFailure(e)
    }
  })

  /** Called when the customer lands back on the site. The redirect itself proves nothing: we ask Paystack. */
  router.get('/api/payments/verify/:reference', requireAuth, async (ctx) => {
    const user = ctx.user!
    const ref = ctx.params.reference as string
    const row = get<PaymentRow & { customer_id: string }>(db, 'SELECT p.*, o.customer_id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.reference = ?', ref)
    if (!row || (row.customer_id !== user.id && !isStaff(user.role))) throw notFound('Payment not found.')

    if (row.status === 'pending') {
      const wait = limiter.check(`pay-verify:${user.id}`, 30, 60_000)
      if (wait) throw tooMany(wait)
      const v = await needPaystack().verify(ref).catch(paystackFailure)
      const p = settle(deps, ref, v)
      return { status: p.status, paidAmountKobo: p.paid_amount_kobo ?? undefined }
    }
    return { status: row.status, paidAmountKobo: row.paid_amount_kobo ?? undefined }
  })

  /**
   * Paystack → us. Authenticated ONLY by the HMAC-SHA512 signature of the exact bytes received.
   * Even then we re-ask Paystack before believing a charge, and every event is processed once.
   */
  router.webhook('/api/payments/webhook/paystack', async (ctx) => {
    if (!config.paystackSecretKey || !deps.paystack) throw new AppError(503, 'payments_unavailable', 'Not configured.')
    const sig = String(ctx.req.headers['x-paystack-signature'] ?? '')
    const expected = createHmac('sha512', config.paystackSecretKey).update(ctx.rawBody ?? '').digest('hex')
    if (!sig || !safeEqual(sig, expected)) throw unauthorized('Bad signature.', 'bad_signature')

    const ev = ctx.body as { event?: string; data?: { reference?: string; transaction_reference?: string; status?: string } }
    const type = String(ev.event ?? '')
    const ref = String(ev.data?.reference ?? ev.data?.transaction_reference ?? '')

    if (type === 'charge.success' && ref) {
      if (get(db, 'SELECT 1 AS x FROM payments WHERE reference = ?', ref)) {
        try { settle(deps, ref, await deps.paystack.verify(ref)) } catch (e) {
          log.log('error', 'webhook settle failed', { ref, error: e instanceof Error ? e.message : String(e) })
          throw new AppError(500, 'retry', 'Try again.') // non-2xx makes Paystack retry later
        }
      }
    } else if ((type === 'refund.processed' || type === 'refund.failed') && ref) {
      const eventId = `${type}:${ref}:${ev.data?.status ?? ''}`
      tx(db, () => {
        if (get(db, 'SELECT 1 AS x FROM payment_events WHERE id = ?', eventId)) return
        run(db, 'INSERT INTO payment_events (id, received_at) VALUES (?, ?)', eventId, iso(clock.now()))
        const r = get<{ id: string; amount_kobo: number; status: string }>(db, "SELECT id,amount_kobo,status FROM refunds WHERE reference = ? AND status = 'pending' ORDER BY created_at LIMIT 1", ref)
        if (!r) return
        run(db, 'UPDATE refunds SET status = ? WHERE id = ?', type === 'refund.processed' ? 'completed' : 'failed', r.id)
        if (type === 'refund.processed') {
          run(db, 'UPDATE orders SET refunded_kobo = refunded_kobo + ? WHERE id = (SELECT order_id FROM payments WHERE reference = ?)', r.amount_kobo, ref)
        }
        audit(deps, null, { actor: { id: 'system', role: 'system' }, action: type === 'refund.processed' ? 'refund.completed' : 'refund.failed', entityType: 'payment', entityId: ref })
      })
    }
    return { received: true }
  })

  /** Staff only. Can never refund more than was paid. */
  router.post('/api/payments/refund', staffOnly, async (ctx) => {
    const b = parse({ reference: str({ min: 1, max: 80 }), amountKobo: int({ min: 100 }), note: str({ min: 5, max: 300, label: 'The note' }) }, ctx.body)
    const paystack = needPaystack()

    const id = tx(db, () => {
      const p = get<PaymentRow>(db, 'SELECT * FROM payments WHERE reference = ?', b.reference)
      if (!p) throw notFound('Payment not found.')
      if (p.status !== 'paid') throw conflict('not_paid', 'Only paid payments can be refunded.')
      const used = get<{ s: number | null }>(db, "SELECT SUM(amount_kobo) AS s FROM refunds WHERE reference = ? AND status IN ('pending','completed')", b.reference)?.s ?? 0
      if (used + b.amountKobo > (p.paid_amount_kobo ?? 0)) throw unprocessable('amountKobo', 'That is more than was paid.')
      const rid = newId()
      run(db, "INSERT INTO refunds (id,reference,amount_kobo,status,note,created_by,created_at) VALUES (?,?,?,'pending',?,?,?)", rid, b.reference, b.amountKobo, b.note, ctx.user!.id, iso(clock.now()))
      audit(deps, ctx, { action: 'refund.requested', entityType: 'payment', entityId: b.reference, meta: { amountKobo: b.amountKobo } })
      return rid
    })

    try {
      const r = await paystack.refund({ reference: b.reference, amountKobo: b.amountKobo, note: b.note })
      if (r.status === 'completed') {
        tx(db, () => {
          run(db, "UPDATE refunds SET status = 'completed' WHERE id = ?", id)
          run(db, 'UPDATE orders SET refunded_kobo = refunded_kobo + ? WHERE id = (SELECT order_id FROM payments WHERE reference = ?)', b.amountKobo, b.reference)
        })
      }
      return { status: r.status, reference: b.reference }
    } catch (e) {
      run(db, "UPDATE refunds SET status = 'failed' WHERE id = ?", id)
      return paystackFailure(e)
    }
  })
}

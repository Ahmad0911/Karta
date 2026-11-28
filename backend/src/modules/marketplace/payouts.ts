import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { conflict, notFound, unprocessable } from '../../platform/errors.ts'
import { requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { POLICY } from './policy.ts'

const DAY = 86_400_000
interface Bank { bankName: string; accountNumber: string; accountName: string }
interface DueRow { id: string; number: string; net_kobo: number; delivered_at: string; refunded_kobo: number }

/**
 * Vendor earnings are paid in batches by Karta staff. A vendor order is "due" once it has been delivered for
 * PAYOUT_HOLD days (the return window), is not already in a payout, and its order has no refund against it
 * (those need a person to look at them first).
 *
 * Staff send the money from the bank / Paystack dashboard, then record the transfer reference here. The API never
 * moves money by itself, so a mistake can't send ₦ to the wrong place.
 */
export function payoutRoutes(router: Router, deps: Deps) {
  const { db, clock } = deps
  const now = () => iso(clock.now())
  const cutoff = () => iso(clock.now() - POLICY.payoutHoldDays * DAY)

  const bankOf = (vendorId: string): Bank | null => {
    const a = get<{ payout: string }>(db, "SELECT payout FROM vendor_applications WHERE user_id = ? AND status = 'approved'", vendorId)
    if (!a) return null
    const b = JSON.parse(a.payout) as Partial<Bank>
    return b.bankName && b.accountName && /^\d{10}$/.test(b.accountNumber ?? '') ? (b as Bank) : null
  }
  const vendorName = (id: string) => get<{ business_name: string | null }>(db, 'SELECT business_name FROM users WHERE id = ?', id)?.business_name ?? 'Vendor'
  const dueRows = (vendorId: string) => all<DueRow>(db,
    `SELECT vo.id, vo.number, vo.net_kobo, vo.delivered_at, o.refunded_kobo FROM vendor_orders vo JOIN orders o ON o.id = vo.order_id
     WHERE vo.vendor_id = ? AND vo.status = 'delivered' AND vo.payout_id IS NULL AND vo.delivered_at <= ? ORDER BY vo.delivered_at`, vendorId, cutoff())
  const mask = (n: string) => `••••${n.slice(-4)}`

  interface PayoutRow { id: string; reference: string; vendor_id: string; amount_kobo: number; status: string; bank_name: string; account_number: string; account_name: string; transfer_ref: string | null; note: string | null; created_at: string; paid_at: string | null }
  const payoutDto = (p: PayoutRow, forStaff: boolean) => ({
    id: p.id, reference: p.reference, amountKobo: p.amount_kobo, status: p.status, bankLabel: `${p.bank_name} ${mask(p.account_number)}`,
    orderIds: all<{ id: string }>(db, 'SELECT id FROM vendor_orders WHERE payout_id = ?', p.id).map((r) => r.id), createdAt: p.created_at, paidAt: p.paid_at,
    ...(forStaff ? { vendorId: p.vendor_id, vendorName: vendorName(p.vendor_id), accountNumber: p.account_number, accountName: p.account_name, transferRef: p.transfer_ref, note: p.note } : {}),
  })

  /* --------------------------------- vendor ---------------------------------- */
  /** Only completed payouts: the vendor sees money that has actually been sent. */
  router.get('/api/vendor/payouts', requireRole('vendor'), (ctx) =>
    ({ payouts: all<PayoutRow>(db, "SELECT * FROM payouts WHERE vendor_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 200", ctx.user!.id).map((p) => payoutDto(p, false)) }))

  /* ---------------------------------- staff ---------------------------------- */
  router.get('/api/admin/payouts/due', staffOnly, () => {
    const vendors = all<{ vendor_id: string }>(db, "SELECT DISTINCT vendor_id FROM vendor_orders WHERE status = 'delivered' AND payout_id IS NULL AND delivered_at <= ?", cutoff())
    return {
      holdDays: POLICY.payoutHoldDays,
      vendors: vendors.map(({ vendor_id }) => {
        const rows = dueRows(vendor_id)
        const ok = rows.filter((r) => r.refunded_kobo === 0)
        const bank = bankOf(vendor_id)
        return {
          vendorId: vendor_id, vendorName: vendorName(vendor_id), vendorEmail: get<{ email: string }>(db, 'SELECT email FROM users WHERE id = ?', vendor_id)?.email,
          bank, amountKobo: ok.reduce((s, r) => s + r.net_kobo, 0), orders: ok.map((r) => ({ number: r.number, netKobo: r.net_kobo, deliveredAt: r.delivered_at })),
          heldForReview: rows.filter((r) => r.refunded_kobo > 0).map((r) => ({ number: r.number, netKobo: r.net_kobo, reason: 'A refund was issued on this order. Review before paying.' })),
          canPay: !!bank && ok.length > 0,
        }
      }).filter((v) => v.orders.length > 0 || v.heldForReview.length > 0),
    }
  })

  router.get('/api/admin/payouts', staffOnly, (ctx) => {
    const status = ctx.query.get('status')
    return { payouts: all<PayoutRow>(db, 'SELECT * FROM payouts ORDER BY created_at DESC LIMIT 300').filter((p) => !status || p.status === status).map((p) => payoutDto(p, true)) }
  })

  /** Lock everything currently due for one vendor into a payout, using the bank details on file right now. */
  router.post('/api/admin/payouts', staffOnly, (ctx) => {
    const { vendorId } = parse({ vendorId: str({ min: 1, max: 64 }) }, ctx.body)
    return tx(db, () => {
      const bank = bankOf(vendorId)
      if (!bank) throw unprocessable('vendorId', 'This vendor has no complete bank account on file.')
      const due = dueRows(vendorId).filter((r) => r.refunded_kobo === 0)
      if (due.length === 0) throw conflict('nothing_due', 'There is nothing due for this vendor.')
      const id = newId()
      const total = due.reduce((s, r) => s + r.net_kobo, 0)
      const reference = `PAY-${1001 + get<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM payouts')!.n}`
      run(db, `INSERT INTO payouts (id,reference,vendor_id,amount_kobo,status,bank_name,account_number,account_name,created_by,created_at) VALUES (?,?,?,?,'pending',?,?,?,?,?)`,
        id, reference, vendorId, total, bank.bankName, bank.accountNumber, bank.accountName, ctx.user!.id, now())
      for (const r of due) {
        // The WHERE guards against a concurrent payout claiming the same delivery.
        const res = run(db, 'UPDATE vendor_orders SET payout_id = ? WHERE id = ? AND payout_id IS NULL', id, r.id)
        if (res.changes === 0) throw conflict('already_in_payout', 'Something changed while creating this payout. Please try again.')
      }
      audit(deps, ctx, { action: 'payout.created', entityType: 'payout', entityId: id, meta: { vendorId, amountKobo: total, orders: due.length } })
      ctx.json(201, payoutDto(get<PayoutRow>(db, 'SELECT * FROM payouts WHERE id = ?', id) as PayoutRow, true))
    })
  })

  /** Staff have sent the money. Record the bank/Paystack transfer reference. */
  router.post('/api/admin/payouts/:id/paid', staffOnly, (ctx) => {
    const { transferRef } = parse({ transferRef: str({ min: 4, max: 80, label: 'The transfer reference' }) }, ctx.body)
    return tx(db, () => {
      const p = get<PayoutRow>(db, 'SELECT * FROM payouts WHERE id = ?', ctx.params.id as string)
      if (!p) throw notFound('Payout not found.')
      if (p.status !== 'pending') throw conflict('not_pending', `This payout is already ${p.status}.`)
      run(db, "UPDATE payouts SET status = 'paid', transfer_ref = ?, paid_at = ? WHERE id = ?", transferRef, now(), p.id)
      audit(deps, ctx, { action: 'payout.paid', entityType: 'payout', entityId: p.id, meta: { amountKobo: p.amount_kobo, transferRef } })
      return payoutDto(get<PayoutRow>(db, 'SELECT * FROM payouts WHERE id = ?', p.id) as PayoutRow, true)
    })
  })

  /** Changed your mind before sending money: release the deliveries so they appear as due again. */
  router.post('/api/admin/payouts/:id/cancel', staffOnly, (ctx) => {
    const { reason } = parse({ reason: str({ min: 5, max: 300, label: 'The reason' }) }, ctx.body)
    return tx(db, () => {
      const p = get<PayoutRow>(db, 'SELECT * FROM payouts WHERE id = ?', ctx.params.id as string)
      if (!p) throw notFound('Payout not found.')
      if (p.status !== 'pending') throw conflict('not_pending', 'Only a pending payout can be cancelled. A paid one is a record of money already sent.')
      run(db, 'UPDATE vendor_orders SET payout_id = NULL WHERE payout_id = ?', p.id)
      run(db, "UPDATE payouts SET status = 'cancelled', note = ? WHERE id = ?", reason, p.id)
      audit(deps, ctx, { action: 'payout.cancelled', entityType: 'payout', entityId: p.id, meta: { reason } })
      return payoutDto(get<PayoutRow>(db, 'SELECT * FROM payouts WHERE id = ?', p.id) as PayoutRow, true)
    })
  })
}

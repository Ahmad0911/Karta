import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { conflict, notFound } from '../../platform/errors.ts'
import { requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { oneOf, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { VENDOR_CAN_DECLINE, VENDOR_NEXT, commissionKobo } from './policy.ts'

type VoStatus = 'new' | 'confirmed' | 'packing' | 'ready_for_pickup' | 'with_logistics' | 'delivered' | 'cancelled'
interface VoRow {
  id: string; order_id: string; vendor_id: string; number: string; status: VoStatus; subtotal_kobo: number; commission_kobo: number; net_kobo: number
  cancel_reason: string | null; created_at: string; updated_at: string; delivered_at: string | null; payout_id: string | null
}
interface OrderRow { id: string; number: string; customer_id: string; ship_state: string; ship_city: string; ship_address: string; created_at: string; paid_at: string | null }

/** Called once, inside the payment settlement transaction: one fulfilment record per vendor in the order. */
export function createVendorOrders(deps: Deps, orderId: string): void {
  const at = iso(deps.clock.now())
  const order = get<{ number: string }>(deps.db, 'SELECT number FROM orders WHERE id = ?', orderId)
  if (!order) return
  const groups = all<{ vendor_id: string; subtotal: number }>(deps.db, 'SELECT vendor_id, SUM(unit_price_kobo * qty) AS subtotal FROM order_lines WHERE order_id = ? GROUP BY vendor_id ORDER BY vendor_id', orderId)
  groups.forEach((g, i) => {
    const id = newId()
    const fee = commissionKobo(g.subtotal)
    run(deps.db, `INSERT OR IGNORE INTO vendor_orders (id,order_id,vendor_id,number,status,subtotal_kobo,commission_kobo,net_kobo,created_at,updated_at) VALUES (?,?,?,?,'new',?,?,?,?,?)`,
      id, orderId, g.vendor_id, groups.length > 1 ? `${order.number}-${i + 1}` : order.number, g.subtotal, fee, g.subtotal - fee, at, at)
    run(deps.db, `INSERT INTO vendor_order_events (id,vendor_order_id,status,at) SELECT ?,id,'new',? FROM vendor_orders WHERE order_id = ? AND vendor_id = ? AND NOT EXISTS (SELECT 1 FROM vendor_order_events e WHERE e.vendor_order_id = vendor_orders.id)`, newId(), at, orderId, g.vendor_id)
  })
}

export function fulfilmentRoutes(router: Router, deps: Deps) {
  const { db, clock } = deps
  const now = () => iso(clock.now())

  const events = (voId: string) => all<{ status: string; at: string; note: string | null }>(db, 'SELECT status,at,note FROM vendor_order_events WHERE vendor_order_id = ? ORDER BY at, rowid', voId)
  const lines = (vo: VoRow) => all<{ listing_id: string; name: string; unit_price_kobo: number; qty: number }>(db, 'SELECT listing_id,name,unit_price_kobo,qty FROM order_lines WHERE order_id = ? AND vendor_id = ?', vo.order_id, vo.vendor_id)
    .map((l) => ({ listingId: l.listing_id, name: l.name, unitPriceKobo: l.unit_price_kobo, qty: l.qty }))

  /** What a VENDOR may know about the customer: a first name and initial, and the city. Nothing to contact them with. */
  function vendorDto(vo: VoRow) {
    const o = get<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', vo.order_id)!
    const name = get<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?', o.customer_id)?.name ?? 'Customer'
    const [first = 'Customer', ...rest] = name.trim().split(/\s+/)
    return {
      id: vo.id, number: vo.number, customerLabel: rest.length ? `${first} ${rest[rest.length - 1]![0]!.toUpperCase()}.` : first,
      city: o.ship_city, state: o.ship_state, lines: lines(vo), subtotalKobo: vo.subtotal_kobo, commissionKobo: vo.commission_kobo, netEarningKobo: vo.net_kobo,
      status: vo.status, placedAt: o.paid_at ?? o.created_at, deliveredAt: vo.delivered_at, cancelReason: vo.cancel_reason, events: events(vo.id),
      // Marked paid only once the money has really been sent.
      payoutId: vo.payout_id && get(db, "SELECT 1 AS x FROM payouts WHERE id = ? AND status = 'paid'", vo.payout_id) ? vo.payout_id : null,
    }
  }

  const transition = (vo: VoRow, to: VoStatus, by: string, note?: string) => {
    run(db, 'UPDATE vendor_orders SET status = ?, updated_at = ?, delivered_at = CASE WHEN ? = \'delivered\' THEN ? ELSE delivered_at END, cancel_reason = CASE WHEN ? = \'cancelled\' THEN ? ELSE cancel_reason END WHERE id = ?', to, now(), to, now(), to, note ?? null, vo.id)
    run(db, 'INSERT INTO vendor_order_events (id,vendor_order_id,status,at,by_user_id,note) VALUES (?,?,?,?,?,?)', newId(), vo.id, to, now(), by, note ?? null)
  }
  const ownVo = (id: string, vendorId: string) => {
    const vo = get<VoRow>(db, 'SELECT * FROM vendor_orders WHERE id = ?', id)
    if (!vo || vo.vendor_id !== vendorId) throw notFound('Order not found.')
    return vo
  }
  const reload = (id: string) => get<VoRow>(db, 'SELECT * FROM vendor_orders WHERE id = ?', id) as VoRow

  /* --------------------------------- vendor ---------------------------------- */
  router.get('/api/vendor/orders', requireRole('vendor'), (ctx) =>
    ({ orders: all<VoRow>(db, 'SELECT * FROM vendor_orders WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 500', ctx.user!.id).map(vendorDto) }))
  router.get('/api/vendor/orders/:id', requireRole('vendor'), (ctx) => vendorDto(ownVo(ctx.params.id as string, ctx.user!.id)))

  /** new → confirmed → packing → ready_for_pickup. After that, logistics take over. */
  router.post('/api/vendor/orders/:id/advance', requireRole('vendor'), (ctx) => tx(db, () => {
    const vo = ownVo(ctx.params.id as string, ctx.user!.id)
    const to = (VENDOR_NEXT as Record<string, VoStatus>)[vo.status]
    if (!to) throw conflict('not_yours_to_move', 'You can’t move this order any further.')
    transition(vo, to, ctx.user!.id)
    return vendorDto(reload(vo.id))
  }))

  /** Declining happens before hand-over. The reason is for Karta only; Karta tells the customer and refunds them. */
  router.post('/api/vendor/orders/:id/decline', requireRole('vendor'), (ctx) => {
    const { reason } = parse({ reason: str({ min: 10, max: 300, label: 'The reason' }) }, ctx.body)
    return tx(db, () => {
      const vo = ownVo(ctx.params.id as string, ctx.user!.id)
      if (!VENDOR_CAN_DECLINE.includes(vo.status)) throw conflict('too_late', 'This order can’t be declined any more.')
      transition(vo, 'cancelled', ctx.user!.id, reason)
      for (const l of lines(vo)) run(db, 'UPDATE listings SET stock = stock + ? WHERE id = ?', l.qty, l.listingId)
      audit(deps, ctx, { action: 'vendor_order.declined', entityType: 'vendor_order', entityId: vo.id, meta: { orderId: vo.order_id, refundDueKobo: vo.subtotal_kobo } })
      return vendorDto(reload(vo.id))
    })
  })

  /* -------------------------------- logistics -------------------------------- */
  /** Drivers need the real address and a phone number to deliver. Only drivers and staff ever see them. */
  function logisticsDto(vo: VoRow) {
    const o = get<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', vo.order_id)!
    const c = get<{ name: string; phone: string | null }>(db, 'SELECT name,phone FROM users WHERE id = ?', o.customer_id)
    const v = get<{ business_name: string | null }>(db, 'SELECT business_name FROM users WHERE id = ?', vo.vendor_id)
    return { ...vendorDto(vo), vendorName: v?.business_name ?? 'Vendor', customerName: c?.name, customerPhone: c?.phone, address: o.ship_address }
  }
  const logistics = requireRole('logistics', 'admin', 'super_admin')

  router.get('/api/logistics/orders', logistics, () =>
    ({ orders: all<VoRow>(db, "SELECT * FROM vendor_orders WHERE status IN ('ready_for_pickup','with_logistics','delivered') ORDER BY updated_at DESC LIMIT 300").map(logisticsDto) }))

  router.post('/api/logistics/orders/:id/status', logistics, (ctx) => {
    const { to } = parse({ to: oneOf(['with_logistics', 'delivered'] as const) }, ctx.body)
    return tx(db, () => {
      const vo = get<VoRow>(db, 'SELECT * FROM vendor_orders WHERE id = ?', ctx.params.id as string)
      if (!vo) throw notFound('Order not found.')
      const ok = (to === 'with_logistics' && vo.status === 'ready_for_pickup') || (to === 'delivered' && vo.status === 'with_logistics')
      if (!ok) throw conflict('wrong_state', `This order is “${vo.status.replace(/_/g, ' ')}”, so it can’t move to “${to.replace(/_/g, ' ')}”.`)
      transition(vo, to, ctx.user!.id)
      audit(deps, ctx, { action: `delivery.${to}`, entityType: 'vendor_order', entityId: vo.id })
      return logisticsDto(reload(vo.id))
    })
  })

  /* ---------------------------------- staff ---------------------------------- */
  router.get('/api/admin/orders', staffOnly, () => {
    const rows = all<OrderRow & { status: string; total_kobo: number; refunded_kobo: number }>(db, "SELECT * FROM orders WHERE status != 'awaiting_payment' ORDER BY created_at DESC LIMIT 300")
    return {
      orders: rows.map((o) => {
        const c = get<{ email: string; name: string }>(db, 'SELECT email,name FROM users WHERE id = ?', o.customer_id)
        const pay = get<{ reference: string }>(db, "SELECT reference FROM payments WHERE order_id = ? AND status = 'paid' ORDER BY paid_at LIMIT 1", o.id)
        const flags = all<{ action: string; entity_id: string }>(db,
          "SELECT action, entity_id FROM audit_log WHERE (entity_type = 'order' AND entity_id = ? AND action = 'payment.oversold') OR (entity_type = 'payment' AND entity_id IN (SELECT reference FROM payments WHERE order_id = ?) AND action IN ('payment.duplicate','payment.amount_mismatch'))", o.id, o.id)
        const declined = all<VoRow>(db, "SELECT * FROM vendor_orders WHERE order_id = ? AND status = 'cancelled'", o.id)
        return {
          id: o.id, number: o.number, status: o.status, totalKobo: o.total_kobo, refundedKobo: o.refunded_kobo, placedAt: o.paid_at ?? o.created_at, customerName: c?.name, customerEmail: c?.email,
          paymentReference: pay?.reference ?? null,
          attention: [
            ...declined.map((d) => ({ kind: 'vendor_declined', text: `A vendor declined ${d.number}. The customer is owed ${(d.subtotal_kobo / 100).toLocaleString('en-NG')} naira.`, refundDueKobo: d.subtotal_kobo })),
            ...flags.map((f) => ({ kind: f.action.replace('payment.', ''), text: f.action === 'payment.duplicate' ? 'This order was paid twice. Refund the extra payment.' : f.action === 'payment.oversold' ? 'An item sold out before payment finished. Refund or restock.' : 'A payment arrived for the wrong amount. Check it.' })),
          ],
          fulfilment: all<VoRow>(db, 'SELECT * FROM vendor_orders WHERE order_id = ?', o.id).map((vo) => ({ id: vo.id, number: vo.number, status: vo.status, vendorId: vo.vendor_id, subtotalKobo: vo.subtotal_kobo, cancelReason: vo.cancel_reason })),
        }
      }),
    }
  })
}

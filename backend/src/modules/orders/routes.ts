import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId, randomToken } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { conflict, forbidden, notFound, unprocessable } from '../../platform/errors.ts'
import { requireAuth, requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { array, int, object, oneOf, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { deliveryFeeKobo } from './delivery.ts'

interface OrderRow {
  id: string; number: string; customer_id: string; status: string; ship_state: string; ship_city: string; ship_address: string
  subtotal_kobo: number; delivery_kobo: number; total_kobo: number; refunded_kobo: number; created_at: string; paid_at: string | null
}
interface ListingRow { id: string; vendor_id: string; name: string; price_kobo: number; stock: number; status: string; reserved_for: string | null }

export function orderRoutes(router: Router, deps: Deps) {
  const { db, clock } = deps

  const linesOf = (orderId: string) => all<{ listing_id: string; name: string; unit_price_kobo: number; qty: number }>(db, 'SELECT listing_id,name,unit_price_kobo,qty FROM order_lines WHERE order_id = ?', orderId)
  const dto = (o: OrderRow) => ({
    id: o.id, number: o.number, status: o.status,
    ship: { state: o.ship_state, city: o.ship_city, address: o.ship_address },
    subtotalKobo: o.subtotal_kobo, deliveryKobo: o.delivery_kobo, totalKobo: o.total_kobo, refundedKobo: o.refunded_kobo,
    lines: linesOf(o.id).map((l) => ({ listingId: l.listing_id, name: l.name, unitPriceKobo: l.unit_price_kobo, qty: l.qty })),
    createdAt: o.created_at, paidAt: o.paid_at,
  })

  /** The customer places an order; the SERVER prices it from its own catalogue. */
  router.post('/api/orders', requireRole('customer'), (ctx) => {
    const user = ctx.user!
    if (!user.phoneVerified) throw forbidden('Please verify your phone number before ordering.', 'phone_not_verified')
    const body = parse({
      lines: array(object({ listingId: str({ min: 1, max: 64 }), qty: int({ min: 1, max: 20 }) }), { max: 20 }),
      ship: object({ state: str({ min: 2, max: 40 }), city: str({ min: 2, max: 80 }), address: str({ min: 8, max: 300, message: 'Enter the full delivery address.' }) }),
    }, ctx.body)
    if (body.lines.length === 0) throw unprocessable('lines', 'Your cart is empty.')

    return tx(db, () => {
      const merged = new Map<string, number>()
      for (const l of body.lines) merged.set(l.listingId, (merged.get(l.listingId) ?? 0) + l.qty)

      let subtotal = 0
      const priced: { l: ListingRow; qty: number }[] = []
      for (const [id, qty] of merged) {
        const l = get<ListingRow>(db, "SELECT id,vendor_id,name,price_kobo,stock,status,reserved_for FROM listings WHERE id = ? AND status = 'live' AND (reserved_for IS NULL OR reserved_for = ?)", id, user.id)
        if (!l) throw unprocessable('lines', 'One of the items is no longer available.')
        if (l.vendor_id === user.id) throw unprocessable('lines', 'You can’t buy your own product.')
        if (l.stock < qty) throw conflict('out_of_stock', `Only ${l.stock} of “${l.name}” left.`)
        subtotal += l.price_kobo * qty
        priced.push({ l, qty })
      }

      const delivery = deliveryFeeKobo(body.ship.state)
      const id = newId()
      const number = `KRT-${randomToken(5).replace(/[-_]/g, 'x').toUpperCase()}`
      const now = iso(clock.now())
      run(db, `INSERT INTO orders (id,number,customer_id,status,ship_state,ship_city,ship_address,subtotal_kobo,delivery_kobo,total_kobo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        id, number, user.id, 'awaiting_payment', body.ship.state, body.ship.city, body.ship.address, subtotal, delivery, subtotal + delivery, now)
      for (const { l, qty } of priced) run(db, 'INSERT INTO order_lines (id,order_id,listing_id,vendor_id,name,unit_price_kobo,qty) VALUES (?,?,?,?,?,?,?)', newId(), id, l.id, l.vendor_id, l.name, l.price_kobo, qty)
      audit(deps, ctx, { action: 'order.created', entityType: 'order', entityId: id, meta: { totalKobo: subtotal + delivery } })
      ctx.json(201, dto(get<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', id) as OrderRow))
    })
  })

  router.get('/api/orders', requireAuth, (ctx) =>
    ({ orders: all<OrderRow>(db, 'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100', ctx.user!.id).map(dto) }))

  router.get('/api/orders/:id', requireAuth, (ctx) => {
    const o = get<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', ctx.params.id as string)
    const staff = ctx.user!.role === 'admin' || ctx.user!.role === 'super_admin'
    // Someone else's order looks exactly like a missing one.
    if (!o || (o.customer_id !== ctx.user!.id && !staff)) throw notFound('Order not found.')
    return dto(o)
  })

  /**
   * Interim catalogue sync. Product data still lives in the web app; until vendor products move into this API,
   * staff publish each listing's server-side price and stock here. Prices are always set by staff, never by a client order.
   */
  router.put('/api/admin/listings/:id', staffOnly, (ctx) => {
    const b = parse({
      vendorEmail: str({ min: 3, max: 254 }), name: str({ min: 2, max: 160 }),
      priceKobo: int({ min: 100, max: 5_000_000_000 }), stock: int({ min: 0, max: 100_000 }), status: oneOf(['draft', 'live', 'paused'] as const),
    }, ctx.body)
    const vendor = get<{ id: string }>(db, "SELECT id FROM users WHERE email = ? AND role = 'vendor'", b.vendorEmail.toLowerCase())
    if (!vendor) throw unprocessable('vendorEmail', 'No vendor with that email.')
    const id = ctx.params.id as string
    tx(db, () => {
      run(db, `INSERT INTO listings (id,vendor_id,name,price_kobo,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET vendor_id=excluded.vendor_id,name=excluded.name,price_kobo=excluded.price_kobo,stock=excluded.stock,status=excluded.status,updated_at=excluded.updated_at`,
        id, vendor.id, b.name, b.priceKobo, b.stock, b.status, iso(clock.now()))
      audit(deps, ctx, { action: 'listing.upserted', entityType: 'listing', entityId: id, meta: { priceKobo: b.priceKobo, stock: b.stock, status: b.status } })
    })
    return { id }
  })
}

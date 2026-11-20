import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { conflict, forbidden, notFound, tooMany, unprocessable } from '../../platform/errors.ts'
import { requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { array, int, oneOf, optional, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { CONTACT_MESSAGE, LIMITS, containsContactInfo } from './rules.ts'

interface RequestRow {
  id: string; number: string; customer_id: string; status: string; title: string; description: string; styles: string; dimensions: string | null
  images: string; city: string; state: string; budget_min_kobo: number | null; budget_max_kobo: number | null
  offer_vendor_id: string | null; offer_price_kobo: number | null; offer_days: number | null; offer_note: string | null; offer_at: string | null; offer_expires_at: string | null
  declined_by: string; listing_id: string | null; removed_reason: string | null; created_at: string; updated_at: string
}
const HOUR = 3_600_000
const ACTIVE = ['open', 'claimed', 'accepted']

export function requestRoutes(router: Router, deps: Deps) {
  const { db, clock, limiter } = deps
  const now = () => iso(clock.now())
  const event = (requestId: string, by: 'customer' | 'admin' | 'system', action: string, note?: string) =>
    run(db, 'INSERT INTO request_events (id,request_id,at,by_role,action,note) VALUES (?,?,?,?,?,?)', newId(), requestId, now(), by, action, note)

  /** An unanswered offer lapses: the request goes back to Karta and that vendor is not offered again. */
  function sweep() {
    tx(db, () => {
      for (const r of all<RequestRow>(db, "SELECT * FROM custom_requests WHERE status = 'claimed' AND offer_expires_at < ?", now())) reopen(r, 'The customer didn’t answer in time, so the request is back with Karta.', 'system')
      for (const r of all<RequestRow>(db, "SELECT * FROM custom_requests WHERE status = 'open' AND created_at < ?", iso(clock.now() - 30 * 24 * HOUR))) {
        run(db, "UPDATE custom_requests SET status = 'closed', updated_at = ? WHERE id = ?", now(), r.id)
        event(r.id, 'system', 'Closed after 30 days with no match')
      }
    })
  }
  function reopen(r: RequestRow, note: string, by: 'customer' | 'system') {
    const declined = new Set<string>(JSON.parse(r.declined_by))
    if (r.offer_vendor_id) declined.add(r.offer_vendor_id)
    run(db, `UPDATE custom_requests SET status='open', offer_vendor_id=NULL, offer_price_kobo=NULL, offer_days=NULL, offer_note=NULL, offer_at=NULL, offer_expires_at=NULL, declined_by=?, updated_at=? WHERE id=?`, JSON.stringify([...declined]), now(), r.id)
    event(r.id, by, by === 'customer' ? 'Offer declined' : 'Offer expired', note)
  }

  const vendorName = (id: string | null) => id ? (get<{ business_name: string | null; name: string }>(db, 'SELECT business_name,name FROM users WHERE id = ?', id)?.business_name ?? 'Vendor') : null
  /** What the customer sees. The vendor is named by business only: no email, no phone. */
  const customerDto = (r: RequestRow) => ({
    id: r.id, number: r.number, status: r.status, title: r.title, description: r.description, styles: JSON.parse(r.styles) as string[], dimensions: r.dimensions,
    images: JSON.parse(r.images) as string[], city: r.city, state: r.state, budgetMinKobo: r.budget_min_kobo, budgetMaxKobo: r.budget_max_kobo,
    offer: r.offer_vendor_id ? { vendorName: vendorName(r.offer_vendor_id), priceKobo: r.offer_price_kobo, days: r.offer_days, note: r.offer_note, expiresAt: r.offer_expires_at, listingId: r.listing_id } : null,
    removedReason: r.status === 'removed' ? r.removed_reason : null, createdAt: r.created_at, updatedAt: r.updated_at,
    events: all<{ at: string; by_role: string; action: string; note: string | null }>(db, 'SELECT at,by_role,action,note FROM request_events WHERE request_id = ? ORDER BY at', r.id).map((e) => ({ at: e.at, by: e.by_role, action: e.action, note: e.note })),
  })
  const adminDto = (r: RequestRow) => {
    const c = get<{ email: string; name: string }>(db, 'SELECT email,name FROM users WHERE id = ?', r.customer_id)
    return { ...customerDto(r), customerEmail: c?.email, customerName: c?.name }
  }

  /* ----------------------------- customers --------------------------------- */
  router.post('/api/requests', requireRole('customer'), (ctx) => {
    const user = ctx.user!
    if (!user.phoneVerified) throw forbidden('Please verify your phone number first.', 'phone_not_verified')
    const b = parse({
      title: str({ min: LIMITS.title[0], max: LIMITS.title[1], label: 'The title' }),
      description: str({ min: LIMITS.description[0], max: LIMITS.description[1], label: 'The description' }),
      styles: optional(array(str({ max: 40 }), { max: 6 })), dimensions: optional(str({ max: 120 })),
      images: optional(array(str({ max: 400 }), { max: LIMITS.maxImages })),
      city: str({ min: 2, max: 80 }), state: str({ min: 2, max: 40 }),
      budgetMinKobo: optional(int({ min: 0, max: 5_000_000_000 })), budgetMaxKobo: optional(int({ min: 0, max: 5_000_000_000 })),
    }, ctx.body)
    for (const f of ['title', 'description', 'dimensions'] as const) if (b[f] && containsContactInfo(b[f] as string)) throw unprocessable(f, CONTACT_MESSAGE)
    if (b.budgetMinKobo !== undefined && b.budgetMaxKobo !== undefined && b.budgetMaxKobo < b.budgetMinKobo) throw unprocessable('budgetMaxKobo', 'The maximum can’t be below the minimum.')

    const wait = limiter.check(`request:${user.id}`, 10, 3_600_000)
    if (wait) throw tooMany(wait)
    sweep()
    return tx(db, () => {
      const active = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM custom_requests WHERE customer_id = ? AND status IN ('open','claimed','accepted')`, user.id)!.n
      if (active >= LIMITS.maxActive) throw conflict('too_many_requests', `You can have ${LIMITS.maxActive} active requests at a time. Close one first.`)
      const today = get<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM custom_requests WHERE customer_id = ? AND created_at > ?', user.id, iso(clock.now() - 24 * HOUR))!.n
      if (today >= LIMITS.maxPerDay) throw conflict('daily_limit', 'You’ve reached today’s limit for requests. Please try again tomorrow.')

      const id = newId()
      const total = get<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM custom_requests')!.n
      run(db, `INSERT INTO custom_requests (id,number,customer_id,status,title,description,styles,dimensions,images,city,state,budget_min_kobo,budget_max_kobo,created_at,updated_at) VALUES (?,?,?,'open',?,?,?,?,?,?,?,?,?,?,?)`,
        id, `REQ-${1001 + total}`, user.id, b.title, b.description, JSON.stringify(b.styles ?? []), b.dimensions, JSON.stringify(b.images ?? []), b.city, b.state, b.budgetMinKobo, b.budgetMaxKobo, now(), now())
      event(id, 'customer', 'Request posted')
      audit(deps, ctx, { action: 'request.created', entityType: 'request', entityId: id })
      ctx.json(201, customerDto(get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', id) as RequestRow))
    })
  })

  const own = (ctx: { user: { id: string } | null; params: Record<string, string> }) => {
    const r = get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', ctx.params.id as string)
    if (!r || r.customer_id !== ctx.user!.id) throw notFound('Request not found.')
    return r
  }
  router.get('/api/requests', requireRole('customer'), (ctx) => { sweep(); return { requests: all<RequestRow>(db, 'SELECT * FROM custom_requests WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100', ctx.user!.id).map(customerDto) } })
  router.get('/api/requests/:id', requireRole('customer'), (ctx) => { sweep(); return customerDto(own(ctx as never)) })

  router.post('/api/requests/:id/respond', requireRole('customer'), (ctx) => {
    const { decision } = parse({ decision: oneOf(['accept', 'decline'] as const) }, ctx.body)
    sweep()
    return tx(db, () => {
      const r = own(ctx as never)
      if (r.status !== 'claimed' || !r.offer_vendor_id) throw conflict('no_offer', 'There is no offer to answer.')
      if (decision === 'decline') { reopen(r, 'The customer declined this offer.', 'customer'); return customerDto(get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', r.id) as RequestRow) }

      // A private piece, bought at exactly the agreed price, by exactly this customer.
      const listingId = newId()
      run(db, `INSERT INTO listings (id,vendor_id,name,price_kobo,stock,status,updated_at,reserved_for) VALUES (?,?,?,?,1,'live',?,?)`, listingId, r.offer_vendor_id, `Custom: ${r.title}`.slice(0, 160), r.offer_price_kobo, now(), r.customer_id)
      run(db, "UPDATE custom_requests SET status='accepted', listing_id=?, updated_at=? WHERE id=?", listingId, now(), r.id)
      event(r.id, 'customer', 'Offer accepted')
      audit(deps, ctx, { action: 'request.accepted', entityType: 'request', entityId: r.id, meta: { listingId } })
      return customerDto(get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', r.id) as RequestRow)
    })
  })

  router.post('/api/requests/:id/close', requireRole('customer'), (ctx) => tx(db, () => {
    const r = own(ctx as never)
    if (!ACTIVE.includes(r.status)) throw conflict('not_active', 'This request is already closed.')
    run(db, "UPDATE custom_requests SET status='closed', updated_at=? WHERE id=?", now(), r.id)
    if (r.listing_id) run(db, "UPDATE listings SET stock = 0, status = 'paused', updated_at = ? WHERE id = ?", now(), r.listing_id)
    event(r.id, 'customer', 'Request closed')
    return customerDto(get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', r.id) as RequestRow)
  }))

  /* -------------------------- Karta staff (the go-between) ----------------- */
  router.get('/api/admin/requests', staffOnly, () => { sweep(); return { requests: all<RequestRow>(db, 'SELECT * FROM custom_requests ORDER BY created_at DESC LIMIT 300').map(adminDto) } })

  /** Staff record the quote a vendor gave Karta and pass it to the customer. The vendor never sees the customer. */
  router.post('/api/admin/requests/:id/offer', staffOnly, (ctx) => {
    const b = parse({
      vendorEmail: str({ min: 3, max: 254 }), priceKobo: int({ min: LIMITS.priceKobo[0], max: LIMITS.priceKobo[1] }),
      days: int({ min: LIMITS.days[0], max: LIMITS.days[1] }), note: str({ min: LIMITS.note[0], max: LIMITS.note[1], label: 'The note' }),
    }, ctx.body)
    if (containsContactInfo(b.note)) throw unprocessable('note', CONTACT_MESSAGE)
    const vendor = get<{ id: string }>(db, `SELECT u.id FROM users u JOIN vendor_applications a ON a.user_id = u.id WHERE u.email = ? AND u.role = 'vendor' AND a.status = 'approved'`, b.vendorEmail.toLowerCase())
    if (!vendor) throw unprocessable('vendorEmail', 'Choose a verified vendor.')
    sweep()
    return tx(db, () => {
      const r = get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', ctx.params.id as string)
      if (!r) throw notFound('Request not found.')
      if (r.status !== 'open') throw conflict('not_open', 'This request already has an offer or is closed.')
      if (r.customer_id === vendor.id) throw unprocessable('vendorEmail', 'A vendor can’t fulfil their own request.')
      if ((JSON.parse(r.declined_by) as string[]).includes(vendor.id)) throw unprocessable('vendorEmail', 'The customer already turned down this vendor.')
      run(db, `UPDATE custom_requests SET status='claimed', offer_vendor_id=?, offer_price_kobo=?, offer_days=?, offer_note=?, offer_at=?, offer_expires_at=?, updated_at=? WHERE id=?`,
        vendor.id, b.priceKobo, b.days, b.note, now(), iso(clock.now() + LIMITS.offerHours * HOUR), now(), r.id)
      event(r.id, 'admin', 'Offer sent by Karta')
      audit(deps, ctx, { action: 'request.offer_sent', entityType: 'request', entityId: r.id, meta: { vendorId: vendor.id, priceKobo: b.priceKobo } })
      return adminDto(get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', r.id) as RequestRow)
    })
  })

  router.post('/api/admin/requests/:id/remove', staffOnly, (ctx) => {
    const { reason } = parse({ reason: str({ min: 5, max: 300, label: 'The reason' }) }, ctx.body)
    return tx(db, () => {
      const r = get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', ctx.params.id as string)
      if (!r) throw notFound('Request not found.')
      if (r.status === 'ordered') throw conflict('already_ordered', 'This request has already been paid for.')
      run(db, "UPDATE custom_requests SET status='removed', removed_reason=?, updated_at=? WHERE id=?", reason, now(), r.id)
      if (r.listing_id) run(db, "UPDATE listings SET stock = 0, status = 'paused', updated_at = ? WHERE id = ?", now(), r.listing_id)
      event(r.id, 'admin', 'Removed by Karta', reason)
      audit(deps, ctx, { action: 'request.removed', entityType: 'request', entityId: r.id, meta: { reason } })
      return adminDto(get<RequestRow>(db, 'SELECT * FROM custom_requests WHERE id = ?', r.id) as RequestRow)
    })
  })
}

import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { conflict, forbidden, invalid, notFound, unprocessable } from '../../platform/errors.ts'
import { requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { array, bool, int, object, oneOf, optional, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { POLICY } from './policy.ts'

export interface ListingRow {
  id: string; vendor_id: string; sku: string | null; name: string; category_id: string; room: string; description: string; material: string; dimensions: string
  colors: string; price_kobo: number; original_price_kobo: number | null; stock: number; status: 'draft' | 'live' | 'paused'
  delivery_min_days: number; delivery_max_days: number; assembly_available: number; images: string; submitted_at: string | null
  moderation_note: string | null; reserved_for: string | null; created_at: string | null; updated_at: string
}

const colorSchema = object({ name: str({ min: 1, max: 40 }), hex: str({ pattern: /^#[0-9a-fA-F]{6}$/, message: 'Use a hex colour like #8a6a4a.' }) })
const fields = {
  name: str({ min: 3, max: 80, label: 'The name' }), categoryId: str({ max: 40 }), room: str({ max: 40 }),
  description: str({ max: 3000 }), material: str({ max: 120 }), dimensions: str({ max: 120 }),
  colors: array(colorSchema, { max: 8 }), priceKobo: int({ min: 100, max: 5_000_000_000 }), originalPriceKobo: int({ min: 100, max: 5_000_000_000 }),
  stock: int({ min: 0, max: 100_000 }), deliveryMinDays: int({ min: 1, max: 90 }), deliveryMaxDays: int({ min: 1, max: 90 }),
  assemblyAvailable: bool(), images: array(str({ min: 8, max: 400 }), { max: POLICY.maxImages }),
}

export function listingRoutes(router: Router, deps: Deps) {
  const { db, clock } = deps
  const now = () => iso(clock.now())
  const approvedVendor = (id: string) => !!get(db, "SELECT 1 AS x FROM vendor_applications WHERE user_id = ? AND status = 'approved'", id)
  const businessName = (id: string) => get<{ business_name: string | null }>(db, 'SELECT business_name FROM users WHERE id = ?', id)?.business_name ?? 'Karta vendor'
  const state = (l: ListingRow) => (l.status === 'draft' && l.submitted_at ? 'in_review' : l.status)

  /** Public shape: no vendor email, no internal notes. */
  const publicDto = (l: ListingRow) => ({
    id: l.id, sku: l.sku, name: l.name, categoryId: l.category_id, room: l.room, description: l.description, material: l.material, dimensions: l.dimensions,
    colors: JSON.parse(l.colors), priceKobo: l.price_kobo, originalPriceKobo: l.original_price_kobo, stock: l.stock,
    deliveryMinDays: l.delivery_min_days, deliveryMaxDays: l.delivery_max_days, assemblyAvailable: l.assembly_available === 1, images: JSON.parse(l.images),
    vendor: { id: l.vendor_id, name: businessName(l.vendor_id) }, custom: l.reserved_for !== null,
  })
  const ownerDto = (l: ListingRow) => ({ ...publicDto(l), status: state(l), moderationNote: l.moderation_note, createdAt: l.created_at, updatedAt: l.updated_at })

  const mine = (id: string, userId: string) => {
    const l = get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', id)
    if (!l || l.vendor_id !== userId) throw notFound('Listing not found.')
    return l
  }
  /** What a listing needs before staff can review it. Reports every gap at once. */
  function problems(l: ListingRow): Record<string, string> {
    const e: Record<string, string> = {}
    if (!l.category_id) e.categoryId = 'Choose a category.'
    if (!l.room) e.room = 'Choose the room it belongs in.'
    if (l.description.trim().length < 40) e.description = 'Describe the piece in at least 40 characters.'
    if (l.material.trim().length < 2) e.material = 'Tell customers what it is made of.'
    if (l.dimensions.trim().length < 3) e.dimensions = 'Add dimensions, for example 180 × 90 × 75 cm.'
    if (l.price_kobo < POLICY.minPriceKobo) e.priceKobo = 'Enter a price of at least ₦1,000.'
    if (l.original_price_kobo !== null && l.original_price_kobo <= l.price_kobo) e.originalPriceKobo = 'The original price must be higher than the selling price.'
    if (l.delivery_max_days < l.delivery_min_days) e.deliveryMaxDays = 'Maximum cannot be lower than the minimum.'
    if ((JSON.parse(l.images) as string[]).length === 0) e.images = 'Add at least one clear photo.'
    return e
  }

  /* --------------------------------- vendor ---------------------------------- */
  router.get('/api/vendor/listings', requireRole('vendor'), (ctx) =>
    ({ listings: all<ListingRow>(db, 'SELECT * FROM listings WHERE vendor_id = ? AND reserved_for IS NULL ORDER BY updated_at DESC LIMIT 500', ctx.user!.id).map(ownerDto) }))

  router.post('/api/vendor/listings', requireRole('vendor'), (ctx) => {
    const { name } = parse({ name: fields.name }, ctx.body)
    const id = newId()
    run(db, `INSERT INTO listings (id,vendor_id,sku,name,price_kobo,stock,status,updated_at,created_at) VALUES (?,?,?,?,?,0,'draft',?,?)`, id, ctx.user!.id, `KRT-${id.slice(0, 6).toUpperCase()}`, name, POLICY.draftPriceKobo, now(), now())
    ctx.json(201, ownerDto(get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', id) as ListingRow))
  })

  router.get('/api/vendor/listings/:id', requireRole('vendor'), (ctx) => ownerDto(mine(ctx.params.id as string, ctx.user!.id)))

  router.put('/api/vendor/listings/:id', requireRole('vendor'), (ctx) => {
    const shape = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, optional(v as never)]))
    const b = parse(shape as never, ctx.body) as Record<string, unknown>
    return tx(db, () => {
      const l = mine(ctx.params.id as string, ctx.user!.id)
      if (l.reserved_for) throw forbidden('This piece was made for a customer and can’t be edited.', 'listing_locked')
      const touched = Object.keys(b).filter((k) => b[k] !== undefined)
      const next = {
        name: (b.name as string) ?? l.name, category_id: (b.categoryId as string) ?? l.category_id, room: (b.room as string) ?? l.room, description: (b.description as string) ?? l.description,
        material: (b.material as string) ?? l.material, dimensions: (b.dimensions as string) ?? l.dimensions, colors: b.colors ? JSON.stringify(b.colors) : l.colors,
        price_kobo: (b.priceKobo as number) ?? l.price_kobo, original_price_kobo: (b.originalPriceKobo as number) ?? l.original_price_kobo, stock: (b.stock as number) ?? l.stock,
        delivery_min_days: (b.deliveryMinDays as number) ?? l.delivery_min_days, delivery_max_days: (b.deliveryMaxDays as number) ?? l.delivery_max_days,
        assembly_available: b.assemblyAvailable === undefined ? l.assembly_available : b.assemblyAvailable ? 1 : 0, images: b.images ? JSON.stringify(b.images) : l.images,
      }
      // Changing anything but stock on a live piece puts it back in front of a reviewer.
      const needsReview = l.status === 'live' && touched.some((k) => k !== 'stock')
      run(db, `UPDATE listings SET name=?,category_id=?,room=?,description=?,material=?,dimensions=?,colors=?,price_kobo=?,original_price_kobo=?,stock=?,delivery_min_days=?,delivery_max_days=?,assembly_available=?,images=?,
        status=?, submitted_at=?, moderation_note=NULL, updated_at=? WHERE id=?`,
      next.name, next.category_id, next.room, next.description, next.material, next.dimensions, next.colors, next.price_kobo, next.original_price_kobo, next.stock, next.delivery_min_days, next.delivery_max_days, next.assembly_available, next.images,
      needsReview ? 'draft' : l.status, needsReview ? now() : l.submitted_at, now(), l.id)
      return ownerDto(get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', l.id) as ListingRow)
    })
  })

  router.post('/api/vendor/listings/:id/submit', requireRole('vendor'), (ctx) => tx(db, () => {
    if (!approvedVendor(ctx.user!.id)) throw forbidden('Your business must be verified before you can list products.', 'vendor_not_approved')
    const l = mine(ctx.params.id as string, ctx.user!.id)
    if (l.status !== 'draft' || l.submitted_at) throw conflict('not_draft', 'Only a draft can be sent for review.')
    const e = problems(l)
    if (Object.keys(e).length) throw invalid(e, 'This listing is incomplete.')
    run(db, 'UPDATE listings SET submitted_at = ?, moderation_note = NULL, updated_at = ? WHERE id = ?', now(), now(), l.id)
    return ownerDto(get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', l.id) as ListingRow)
  }))

  for (const [action, from, to] of [['pause', 'live', 'paused'], ['resume', 'paused', 'live']] as const) {
    router.post(`/api/vendor/listings/:id/${action}`, requireRole('vendor'), (ctx) => tx(db, () => {
      const l = mine(ctx.params.id as string, ctx.user!.id)
      if (l.status !== from) throw conflict('wrong_state', `Only a ${from} listing can be ${action}d.`)
      run(db, 'UPDATE listings SET status = ?, updated_at = ? WHERE id = ?', to, now(), l.id)
      return ownerDto(get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', l.id) as ListingRow)
    }))
  }

  router.delete('/api/vendor/listings/:id', requireRole('vendor'), (ctx) => tx(db, () => {
    const l = mine(ctx.params.id as string, ctx.user!.id)
    if (l.status !== 'draft' || l.submitted_at) throw conflict('not_draft', 'Only drafts can be deleted. Pause a live listing instead.')
    if (get(db, 'SELECT 1 AS x FROM order_lines WHERE listing_id = ?', l.id)) throw conflict('has_orders', 'This listing has orders and can’t be deleted.')
    run(db, 'DELETE FROM listings WHERE id = ?', l.id)
    return { deleted: true }
  }))

  /* ---------------------------------- staff ---------------------------------- */
  router.get('/api/admin/listings', staffOnly, (ctx) => {
    const status = ctx.query.get('status')
    const rows = all<ListingRow>(db, 'SELECT * FROM listings WHERE reserved_for IS NULL ORDER BY updated_at DESC LIMIT 500').filter((l) => !status || state(l) === status)
    return { listings: rows.map((l) => ({ ...ownerDto(l), vendorEmail: get<{ email: string }>(db, 'SELECT email FROM users WHERE id = ?', l.vendor_id)?.email })) }
  })

  router.post('/api/admin/listings/:id/review', staffOnly, (ctx) => {
    const b = parse({ decision: oneOf(['approve', 'send_back'] as const), note: optional(str({ min: 5, max: 500, label: 'The note' })) }, ctx.body)
    if (b.decision === 'send_back' && !b.note) throw unprocessable('note', 'Tell the vendor what to fix.')
    return tx(db, () => {
      const l = get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', ctx.params.id as string)
      if (!l) throw notFound('Listing not found.')
      if (state(l) !== 'in_review') throw conflict('not_in_review', 'This listing isn’t waiting for review.')
      if (b.decision === 'approve') {
        const e = problems(l)
        if (Object.keys(e).length) throw invalid(e, 'This listing is incomplete.')
        run(db, "UPDATE listings SET status = 'live', submitted_at = NULL, moderation_note = NULL, updated_at = ? WHERE id = ?", now(), l.id)
      } else {
        run(db, "UPDATE listings SET status = 'draft', submitted_at = NULL, moderation_note = ?, updated_at = ? WHERE id = ?", b.note, now(), l.id)
      }
      audit(deps, ctx, { action: b.decision === 'approve' ? 'listing.approved' : 'listing.sent_back', entityType: 'listing', entityId: l.id })
      return ownerDto(get<ListingRow>(db, 'SELECT * FROM listings WHERE id = ?', l.id) as ListingRow)
    })
  })

  /* ---------------------------------- public --------------------------------- */
  const LIVE = `l.status = 'live' AND l.stock >= 0 AND EXISTS (SELECT 1 FROM vendor_applications a WHERE a.user_id = l.vendor_id AND a.status = 'approved')`

  router.get('/api/catalog', (ctx) => {
    const category = ctx.query.get('category'), room = ctx.query.get('room'), q = (ctx.query.get('q') ?? '').trim().toLowerCase().slice(0, 60)
    const page = Math.max(1, Number(ctx.query.get('page') ?? 1) || 1)
    const rows = all<ListingRow>(db, `SELECT l.* FROM listings l WHERE ${LIVE} AND l.reserved_for IS NULL ORDER BY l.updated_at DESC LIMIT 1000`)
      .filter((l) => (!category || l.category_id === category) && (!room || l.room === room) && (!q || `${l.name} ${l.description} ${l.material}`.toLowerCase().includes(q)))
    return { total: rows.length, page, listings: rows.slice((page - 1) * 24, page * 24).map(publicDto) }
  })

  /** A made-for-you piece is visible to its customer only; everyone else gets "not found". */
  router.get('/api/catalog/:id', (ctx) => {
    const l = get<ListingRow>(db, `SELECT l.* FROM listings l WHERE l.id = ? AND ${LIVE}`, ctx.params.id as string)
    if (!l || (l.reserved_for !== null && l.reserved_for !== ctx.user?.id)) throw notFound('Product not found.')
    return publicDto(l)
  })
}

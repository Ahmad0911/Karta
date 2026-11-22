import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { findUserByEmail, insertUser } from '../src/modules/auth/users.ts'
import { hashPassword, newId } from '../src/platform/crypto.ts'
import type { PaystackClient, PaystackVerify } from '../src/platform/paystack.ts'
import { ORIGIN, PASSWORD, signUp, start, uniqueEmail, verify, type Client, type Harness } from './harness.ts'

class FakePaystack implements PaystackClient {
  results = new Map<string, PaystackVerify>()
  async initialize(i: { reference: string }) { return { authorizationUrl: `https://checkout.paystack.test/${i.reference}`, reference: i.reference } }
  async verify(reference: string) { return this.results.get(reference) ?? { status: 'pending' as const, amountKobo: 0, currency: 'NGN', reference } }
  async refund() { return { status: 'completed' as const } }
}

let h: Harness
let ps: FakePaystack
let admin: Client
before(async () => { ps = new FakePaystack(); h = await start({ PAYSTACK_SECRET_KEY: 'sk_test_abc123' }, { paystack: ps }); admin = await h.makeAdmin() })
after(async () => { await h.close() })

async function vendor(name: string, approved = true) {
  const v = await signUp(h, { role: 'vendor', businessName: name })
  if (approved) h.deps.db.prepare('INSERT INTO vendor_applications (id,user_id,status,business,contact,payout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(`app_${v.user.id}`, v.user.id, 'approved', '{}', '{}', '{}', new Date().toISOString(), new Date().toISOString())
  return v
}
async function driver() {
  const email = uniqueEmail('driver')
  insertUser(h.deps.db, { id: newId(), email, name: 'Driver Dan', role: 'logistics', passwordHash: await hashPassword(PASSWORD, h.deps.config.scryptN), emailVerifiedAt: new Date().toISOString(), now: new Date().toISOString() })
  const c = h.client(); assert.equal((await c.post('/api/auth/login', { email, password: PASSWORD })).status, 200)
  void findUserByEmail
  return c
}
const full = { categoryId: 'sofas', room: 'living', description: 'A three-seater curved sofa with solid walnut legs and a washable linen cover.', material: 'Walnut and linen', dimensions: '210 × 95 × 80 cm', priceKobo: 45_000_000, stock: 5, deliveryMinDays: 5, deliveryMaxDays: 10, images: ['https://cdn.karta.test/sofa-1.jpg'] }
async function liveListing(v: { c: Client }, name = 'Curved walnut sofa', over: Record<string, unknown> = {}) {
  const d = (await v.c.post('/api/vendor/listings', { name })).body
  assert.equal((await v.c.put(`/api/vendor/listings/${d.id}`, { ...full, ...over })).status, 200)
  assert.equal((await v.c.post(`/api/vendor/listings/${d.id}/submit`)).status, 200)
  assert.equal((await admin.post(`/api/admin/listings/${d.id}/review`, { decision: 'approve' })).status, 200)
  return d.id as string
}
const ship = { state: 'FCT (Abuja)', city: 'Abuja', address: '12 Example Street, Wuse' }

describe('vendor listings and review', () => {
  it('starts as a draft with just a name; submitting lists every gap; unverified vendors cannot submit', async () => {
    const v = await vendor('Ade Woodworks')
    const d = await v.c.post('/api/vendor/listings', { name: 'Oak shelf' })
    assert.equal(d.status, 201); assert.equal(d.body.status, 'draft')
    const bad = await v.c.post(`/api/vendor/listings/${d.body.id}/submit`)
    assert.equal(bad.status, 422)
    for (const k of ['categoryId', 'room', 'description', 'material', 'dimensions', 'priceKobo', 'images']) assert.ok(bad.body.error.details.fields[k], `missing ${k}`)
    const u = await vendor('Unverified Co', false)
    const ud = (await u.c.post('/api/vendor/listings', { name: 'Chair set' })).body
    await u.c.put(`/api/vendor/listings/${ud.id}`, full)
    assert.equal((await u.c.post(`/api/vendor/listings/${ud.id}/submit`)).status, 403)
  })
  it('review: vendors cannot approve themselves; send-back needs a note; the vendor sees it, fixes, resubmits; approval makes it live', async () => {
    const v = await vendor('Review Shop')
    const id = (await v.c.post('/api/vendor/listings', { name: 'Curved sofa' })).body.id
    await v.c.put(`/api/vendor/listings/${id}`, full); await v.c.post(`/api/vendor/listings/${id}/submit`)
    assert.equal((await v.c.post(`/api/admin/listings/${id}/review`, { decision: 'approve' })).status, 403)
    assert.equal((await admin.post(`/api/admin/listings/${id}/review`, { decision: 'send_back' })).status, 422)
    const sent = await admin.post(`/api/admin/listings/${id}/review`, { decision: 'send_back', note: 'Photos are too dark, please retake.' })
    assert.equal(sent.body.status, 'draft')
    assert.equal((await v.c.get(`/api/vendor/listings/${id}`)).body.moderationNote, 'Photos are too dark, please retake.')
    assert.equal((await admin.post(`/api/admin/listings/${id}/review`, { decision: 'approve' })).status, 409, 'only listings in review')
    await v.c.post(`/api/vendor/listings/${id}/submit`)
    assert.equal((await admin.post(`/api/admin/listings/${id}/review`, { decision: 'approve' })).body.status, 'live')
  })
  it('the public catalogue shows live pieces only, never leaks the vendor’s email, and hides paused ones', async () => {
    const v = await vendor('Catalogue Shop')
    const id = await liveListing(v, 'Rattan lounge chair')
    const draft = (await v.c.post('/api/vendor/listings', { name: 'Hidden draft piece' })).body.id
    const anon = h.client()
    const list = (await anon.get('/api/catalog')).body.listings as { id: string; vendor: { name: string } }[]
    assert.ok(list.some((l) => l.id === id)); assert.ok(!list.some((l) => l.id === draft))
    assert.equal(list.find((l) => l.id === id)!.vendor.name, 'Catalogue Shop')
    assert.ok(!JSON.stringify(list).includes(v.u.email))
    assert.equal((await anon.get(`/api/catalog/${draft}`)).status, 404)
    assert.ok(((await anon.get('/api/catalog?q=rattan')).body.listings as unknown[]).length >= 1)
    await v.c.post(`/api/vendor/listings/${id}/pause`)
    assert.equal((await anon.get(`/api/catalog/${id}`)).status, 404)
    await v.c.post(`/api/vendor/listings/${id}/resume`)
    assert.equal((await anon.get(`/api/catalog/${id}`)).status, 200)
  })
  it('stock edits keep a piece live; content edits send it back to review and hide it', async () => {
    const v = await vendor('Edit Shop'); const id = await liveListing(v, 'Marble side table')
    assert.equal((await v.c.put(`/api/vendor/listings/${id}`, { stock: 9 })).body.status, 'live')
    const edited = await v.c.put(`/api/vendor/listings/${id}`, { priceKobo: 100 * 1000 })
    assert.equal(edited.body.status, 'in_review')
    assert.equal((await h.client().get(`/api/catalog/${id}`)).status, 404)
  })
  it('vendors only touch their own listings; customers cannot use vendor routes; only drafts delete', async () => {
    const a = await vendor('Shop A'), b = await vendor('Shop B')
    const id = (await a.c.post('/api/vendor/listings', { name: 'Shop A stool' })).body.id
    assert.equal((await b.c.get(`/api/vendor/listings/${id}`)).status, 404)
    assert.equal((await b.c.put(`/api/vendor/listings/${id}`, { stock: 1000 })).status, 404)
    const cu = await signUp(h)
    assert.equal((await cu.c.get('/api/vendor/listings')).status, 403)
    assert.equal((await cu.c.post('/api/vendor/listings', { name: 'Sneaky listing' })).status, 403)
    assert.equal((await a.c.del(`/api/vendor/listings/${id}`)).status, 200)
    const live = await liveListing(a, 'Shop A bench')
    assert.equal((await a.c.del(`/api/vendor/listings/${live}`)).status, 409)
  })
})

describe('public vendor directory', () => {
  it('lists verified vendors only, with no contact or bank details', async () => {
    const ok = await vendor('Directory Shop'); const pending = await vendor('Pending Shop', false)
    const list = (await h.client().get('/api/vendors')).body.vendors as { id: string; name: string }[]
    assert.ok(list.some((v) => v.id === ok.user.id)); assert.ok(!list.some((v) => v.id === pending.user.id))
    const raw = JSON.stringify(list)
    assert.ok(!raw.includes(ok.u.email)); assert.ok(!/accountNumber|bankName|phone/i.test(raw))
  })
})

describe('admin vendor list carries the full application', () => {
  it('so the review screens need only one request', async () => {
    const v = await vendor('Full App Shop')
    h.deps.db.prepare("UPDATE vendor_applications SET status = 'under_review', submitted_at = ? WHERE user_id = ?").run(new Date().toISOString(), v.user.id)
    const list = (await admin.get('/api/admin/vendor-applications')).body.applications as { email: string; application: { contact: { phone: string }; status: string } }[]
    const row = list.find((a) => a.email === v.u.email)!
    assert.equal(row.application.status, 'under_review'); assert.ok('contact' in row.application)
    assert.equal((await v.c.get('/api/admin/vendor-applications')).status, 403)
  })
})

describe('paid orders become per-vendor fulfilment', () => {
  async function paidTwoVendorOrder() {
    const v1 = await vendor('Vendor Uno'), v2 = await vendor('Vendor Dos')
    const l1 = await liveListing(v1, 'Uno sofa', { stock: 5 }), l2 = await liveListing(v2, 'Dos table', { priceKobo: 20_000_000, stock: 5 })
    const buyer = await signUp(h, { name: 'Chidinma Okafor' }); await verify(h, buyer.c, 'phone', buyer.u.phone as string)
    const o = (await buyer.c.post('/api/orders', { lines: [{ listingId: l1, qty: 1 }, { listingId: l2, qty: 2 }], ship })).body
    const pay = (await buyer.c.post('/api/payments/initialize', { orderId: o.id, returnUrl: `${ORIGIN}/x` })).body
    ps.results.set(pay.reference, { status: 'success', amountKobo: o.totalKobo, currency: 'NGN', reference: pay.reference })
    await buyer.c.get(`/api/payments/verify/${pay.reference}`)
    return { v1, v2, l1, l2, buyer, o }
  }
  it('creates one order per vendor, each seeing only its own items, with a 10% commission', async () => {
    const { v1, v2, o } = await paidTwoVendorOrder()
    const a = (await v1.c.get('/api/vendor/orders')).body.orders, b = (await v2.c.get('/api/vendor/orders')).body.orders
    assert.equal(a.length, 1); assert.equal(b.length, 1)
    assert.equal(a[0].lines.length, 1); assert.equal(a[0].lines[0].name, 'Uno sofa')
    assert.equal(a[0].subtotalKobo, 45_000_000); assert.equal(a[0].commissionKobo, 4_500_000); assert.equal(a[0].netEarningKobo, 40_500_000)
    assert.equal(b[0].subtotalKobo, 40_000_000)
    assert.equal(a[0].status, 'new')
    assert.equal((await v2.c.get(`/api/vendor/orders/${a[0].id}`)).status, 404)
    void o
  })
  it('vendors learn the customer’s first name and initial and the city, and nothing to contact them with', async () => {
    const { v1, buyer } = await paidTwoVendorOrder()
    const order = (await v1.c.get('/api/vendor/orders')).body.orders.at(-1)
    assert.equal(order.customerLabel, 'Chidinma O.'); assert.equal(order.city, 'Abuja')
    const raw = JSON.stringify(order)
    for (const secret of [buyer.u.email, buyer.u.phone as string, '12 Example Street', 'Wuse']) assert.ok(!raw.includes(secret), `leaked ${secret}`)
  })
  it('the vendor moves it new → confirmed → packing → ready, cannot skip or deliver, and cannot touch someone else’s', async () => {
    const { v1, v2 } = await paidTwoVendorOrder()
    const id = (await v1.c.get('/api/vendor/orders')).body.orders.at(-1).id
    assert.equal((await v2.c.post(`/api/vendor/orders/${id}/advance`)).status, 404)
    for (const s of ['confirmed', 'packing', 'ready_for_pickup']) assert.equal((await v1.c.post(`/api/vendor/orders/${id}/advance`)).body.status, s)
    assert.equal((await v1.c.post(`/api/vendor/orders/${id}/advance`)).status, 409, 'hand-over is the driver’s')
    assert.equal((await v1.c.post(`/api/logistics/orders/${id}/status`, { to: 'delivered' })).status, 403)
  })
  it('drivers collect and deliver, and are the only ones who see the address and phone', async () => {
    const { v1, buyer } = await paidTwoVendorOrder(); const d = await driver()
    const id = (await v1.c.get('/api/vendor/orders')).body.orders.at(-1).id
    assert.equal((await d.post(`/api/logistics/orders/${id}/status`, { to: 'with_logistics' })).status, 409, 'not ready yet')
    for (let i = 0; i < 3; i++) await v1.c.post(`/api/vendor/orders/${id}/advance`)
    assert.equal((await d.post(`/api/logistics/orders/${id}/status`, { to: 'delivered' })).status, 409, 'must be collected first')
    const picked = await d.post(`/api/logistics/orders/${id}/status`, { to: 'with_logistics' })
    assert.equal(picked.status, 200)
    assert.equal(picked.body.address, '12 Example Street, Wuse'); assert.equal(picked.body.customerPhone, buyer.u.phone)
    assert.equal((await d.post(`/api/logistics/orders/${id}/status`, { to: 'delivered' })).body.status, 'delivered')
    assert.equal((await buyer.c.get('/api/logistics/orders')).status, 403)
    assert.equal((await v1.c.get('/api/logistics/orders')).status, 403)
  })
  it('declining needs a reason, restocks the item, and flags the refund for staff', async () => {
    const { v1, l1 } = await paidTwoVendorOrder()
    const id = (await v1.c.get('/api/vendor/orders')).body.orders.at(-1).id
    const stock = (h.deps.db.prepare('SELECT stock FROM listings WHERE id = ?').get(l1) as { stock: number }).stock
    assert.equal((await v1.c.post(`/api/vendor/orders/${id}/decline`, { reason: 'no' })).status, 422)
    const r = await v1.c.post(`/api/vendor/orders/${id}/decline`, { reason: 'Wood supplier ran out of walnut.' })
    assert.equal(r.body.status, 'cancelled')
    assert.equal((h.deps.db.prepare('SELECT stock FROM listings WHERE id = ?').get(l1) as { stock: number }).stock, stock + 1)
    assert.ok(h.deps.db.prepare("SELECT 1 FROM audit_log WHERE action = 'vendor_order.declined' AND entity_id = ?").get(id))
    assert.equal((await v1.c.post(`/api/vendor/orders/${id}/decline`, { reason: 'Trying to decline twice.' })).status, 409)
  })
  it('customers see progress by vendor name; staff see every order', async () => {
    const { buyer, o } = await paidTwoVendorOrder()
    const mine = (await buyer.c.get(`/api/orders/${o.id}`)).body
    assert.equal(mine.fulfilment.length, 2)
    assert.deepEqual(mine.fulfilment.map((f: { vendorName: string }) => f.vendorName).sort(), ['Vendor Dos', 'Vendor Uno'])
    assert.ok(!JSON.stringify(mine.fulfilment).includes('@'))
    const all = (await admin.get('/api/admin/orders')).body.orders
    assert.ok(all.some((x: { id: string }) => x.id === o.id))
    assert.equal((await buyer.c.get('/api/admin/orders')).status, 403)
  })
})

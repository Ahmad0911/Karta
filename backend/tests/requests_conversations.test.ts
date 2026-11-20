import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import type { PaystackClient, PaystackVerify } from '../src/platform/paystack.ts'
import { ORIGIN, signUp, start, verify, type Client, type Harness } from './harness.ts'

class FakePaystack implements PaystackClient {
  results = new Map<string, PaystackVerify>()
  async initialize(i: { reference: string }) { return { authorizationUrl: `https://checkout.paystack.test/${i.reference}`, reference: i.reference } }
  async verify(reference: string) { return this.results.get(reference) ?? { status: 'pending' as const, amountKobo: 0, currency: 'NGN', reference } }
  async refund() { return { status: 'completed' as const } }
}

let h: Harness
let ps: FakePaystack
let admin: Client
const HOUR = 3_600_000

before(async () => {
  ps = new FakePaystack()
  h = await start({ PAYSTACK_SECRET_KEY: 'sk_test_abc123' }, { paystack: ps })
  admin = await h.makeAdmin()
})
after(async () => { await h.close() })

const customer = async () => { const s = await signUp(h); await verify(h, s.c, 'phone', s.u.phone as string); return s }
/** An approved vendor (admins approve vendors in the real flow; tests set it directly). */
async function approvedVendor(name = 'Ade Woodworks') {
  const v = await signUp(h, { role: 'vendor', businessName: name })
  h.deps.db.prepare("INSERT INTO vendor_applications (id,user_id,status,business,contact,payout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(`app_${v.user.id}`, v.user.id, 'approved', '{}', '{}', '{}', new Date().toISOString(), new Date().toISOString())
  return v
}
const good = { title: 'Curved walnut sofa in sand', description: 'A three-seater curved sofa with walnut legs and a washable cover please.', city: 'Abuja', state: 'FCT (Abuja)', budgetMinKobo: 30_000_000, budgetMaxKobo: 60_000_000 }
const offer = (vendorEmail: string, over: Record<string, unknown> = {}) => ({ vendorEmail, priceKobo: 45_000_000, days: 21, note: 'Solid walnut with a washable cover, made to your photo.', ...over })

describe('custom requests', () => {
  it('validates, and keeps contact details out', async () => {
    const { c } = await customer()
    assert.equal((await c.post('/api/requests', { ...good, title: 'Sofa' })).status, 422)
    assert.equal((await c.post('/api/requests', { ...good, description: 'Please call me on 08031234567 about a sofa' })).status, 422)
    assert.equal((await c.post('/api/requests', { ...good, title: 'Sofa, email me ade@x.com please' })).status, 422)
    assert.equal((await c.post('/api/requests', { ...good, budgetMinKobo: 600, budgetMaxKobo: 300 })).status, 422)
    assert.equal((await c.post('/api/requests', good)).status, 201)
  })
  it('needs a verified phone and the customer role; allows 3 active at a time', async () => {
    const raw = await signUp(h)
    assert.equal((await raw.c.post('/api/requests', good)).status, 403)
    const v = await approvedVendor()
    assert.equal((await v.c.post('/api/requests', good)).status, 403)
    const { c } = await customer()
    for (let i = 0; i < 3; i++) assert.equal((await c.post('/api/requests', { ...good, title: `Piece number ${i} please` })).status, 201)
    assert.equal((await c.post('/api/requests', good)).status, 409)
  })
  it('vendors never see requests, and customers never see each other’s', async () => {
    const { c } = await customer()
    const r = (await c.post('/api/requests', good)).body
    const v = await approvedVendor()
    assert.equal((await v.c.get('/api/requests')).status, 403)
    assert.equal((await v.c.get(`/api/requests/${r.id}`)).status, 403)
    assert.equal((await v.c.get('/api/admin/requests')).status, 403)
    const other = await customer()
    assert.equal((await other.c.get(`/api/requests/${r.id}`)).status, 404)
    assert.equal((await other.c.post(`/api/requests/${r.id}/close`)).status, 404)
    assert.equal((await admin.get('/api/admin/requests')).status, 200)
  })
  it('ONLY staff can send an offer, and only for a verified vendor', async () => {
    const { c } = await customer()
    const r = (await c.post('/api/requests', good)).body
    const v = await approvedVendor()
    const pending = await signUp(h, { role: 'vendor', businessName: 'Unverified Shop' })
    assert.equal((await c.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))).status, 403)
    assert.equal((await v.c.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))).status, 403)
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(pending.u.email))).status, 422)
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email, { priceKobo: 500 }))).status, 422)
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email, { note: 'WhatsApp me for a cheaper quote' }))).status, 422)
    const ok = await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))
    assert.equal(ok.status, 200)
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))).status, 409, 'one offer at a time')
    const seen = (await c.get(`/api/requests/${r.id}`)).body
    assert.equal(seen.status, 'claimed')
    assert.equal(seen.offer.vendorName, 'Ade Woodworks')
    assert.equal(seen.offer.priceKobo, 45_000_000)
    assert.ok(!JSON.stringify(seen).includes(v.u.email), 'the customer never learns the vendor’s email')
    assert.ok(!JSON.stringify(seen).includes('vendorEmail'))
  })
  it('declining sends it back to Karta and bars that vendor', async () => {
    const { c } = await customer()
    const r = (await c.post('/api/requests', good)).body
    const v1 = await approvedVendor('Vendor One'), v2 = await approvedVendor('Vendor Two')
    await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v1.u.email))
    assert.equal((await c.post(`/api/requests/${r.id}/respond`, { decision: 'decline' })).body.status, 'open')
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v1.u.email))).status, 422)
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v2.u.email))).status, 200)
  })
  it('an unanswered offer lapses after 72 hours', async () => {
    const { c } = await customer()
    const r = (await c.post('/api/requests', good)).body
    const v = await approvedVendor()
    await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))
    // Move the deadline into the past (advancing the shared clock would also expire everyone's login).
    h.deps.db.prepare('UPDATE custom_requests SET offer_expires_at = ? WHERE id = ?').run(new Date(Date.now() - HOUR).toISOString(), r.id)
    assert.equal((await c.get(`/api/requests/${r.id}`)).body.status, 'open')
    assert.equal((await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))).status, 422)
  })
  it('accept → a private piece only this customer can buy → paid → ordered', async () => {
    const { c, u } = await customer()
    const r = (await c.post('/api/requests', good)).body
    const v = await approvedVendor()
    await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))
    assert.equal((await c.post(`/api/requests/${r.id}/respond`, { decision: 'accept' })).status, 200)
    const accepted = (await c.get(`/api/requests/${r.id}`)).body
    assert.equal(accepted.status, 'accepted')
    const lid = accepted.offer.listingId
    const ship = { state: 'FCT (Abuja)', city: 'Abuja', address: '12 Example Street, Wuse' }

    const stranger = await customer()
    assert.equal((await stranger.c.post('/api/orders', { lines: [{ listingId: lid, qty: 1 }], ship })).status, 422, 'nobody else can buy it')

    const o = await c.post('/api/orders', { lines: [{ listingId: lid, qty: 1 }], ship })
    assert.equal(o.status, 201)
    assert.equal(o.body.subtotalKobo, 45_000_000, 'bought at exactly the agreed price')
    const pay = await c.post('/api/payments/initialize', { orderId: o.body.id, returnUrl: `${ORIGIN}/checkout/return` })
    ps.results.set(pay.body.reference, { status: 'success', amountKobo: o.body.totalKobo, currency: 'NGN', reference: pay.body.reference })
    await c.get(`/api/payments/verify/${pay.body.reference}`)
    assert.equal((await c.get(`/api/requests/${r.id}`)).body.status, 'ordered')
    assert.equal((await c.post(`/api/requests/${r.id}/close`)).status, 409, 'an ordered request can’t be closed')
    void u
  })
  it('closing an accepted request retires the private piece; staff can remove with a reason', async () => {
    const { c } = await customer()
    const r = (await c.post('/api/requests', good)).body
    const v = await approvedVendor()
    await admin.post(`/api/admin/requests/${r.id}/offer`, offer(v.u.email))
    await c.post(`/api/requests/${r.id}/respond`, { decision: 'accept' })
    const lid = (await c.get(`/api/requests/${r.id}`)).body.offer.listingId
    assert.equal((await c.post(`/api/requests/${r.id}/close`)).body.status, 'closed')
    assert.equal((h.deps.db.prepare('SELECT stock FROM listings WHERE id = ?').get(lid) as { stock: number }).stock, 0)

    const r2 = (await c.post('/api/requests', good)).body
    assert.equal((await c.post(`/api/admin/requests/${r2.id}/remove`, { reason: 'nope nope' })).status, 403)
    assert.equal((await admin.post(`/api/admin/requests/${r2.id}/remove`, { reason: 'no' })).status, 422)
    assert.equal((await admin.post(`/api/admin/requests/${r2.id}/remove`, { reason: 'Contains abusive language' })).status, 200)
    assert.equal((await admin.post(`/api/admin/requests/${r2.id}/offer`, offer(v.u.email))).status, 409)
  })
})

describe('Karta chat: customers and vendors never share a conversation', () => {
  const body = (over: Record<string, unknown> = {}) => ({ subject: 'A question for Karta', category: 'other', message: 'Hello Karta team', ...over })

  it('a customer and a vendor each only ever see their own conversations', async () => {
    const cu = await customer(), ve = await approvedVendor()
    const cc = (await cu.c.post('/api/conversations', body({ subject: 'Custom sofa question' }))).body
    const vc = (await ve.c.post('/api/conversations', body({ subject: 'Payout question', category: 'payment' }))).body
    assert.equal(cc.number.startsWith('SUP-'), true)
    assert.deepEqual((await cu.c.get('/api/conversations')).body.conversations.map((x: { id: string }) => x.id), [cc.id])
    assert.deepEqual((await ve.c.get('/api/conversations')).body.conversations.map((x: { id: string }) => x.id), [vc.id])
    // reading or writing into the other side's thread looks like it doesn't exist
    assert.equal((await ve.c.get(`/api/conversations/${cc.id}`)).status, 404)
    assert.equal((await ve.c.post(`/api/conversations/${cc.id}/messages`, { message: 'hi customer' })).status, 404)
    assert.equal((await cu.c.get(`/api/conversations/${vc.id}`)).status, 404)
    assert.equal((await cu.c.post(`/api/conversations/${vc.id}/messages`, { message: 'hi vendor' })).status, 404)
    assert.equal((await cu.c.post(`/api/conversations/${vc.id}/close`)).status, 404)
  })
  it('requires sign-in; staff accounts use the admin inbox instead', async () => {
    assert.equal((await h.client().get('/api/conversations')).status, 401)
    assert.equal((await admin.get('/api/conversations')).status, 403)
    assert.equal((await admin.post('/api/conversations', body())).status, 403)
  })
  it('a customer can attach their own order/request; a vendor can not attach anything', async () => {
    const cu = await customer(), ve = await approvedVendor()
    const req = (await cu.c.post('/api/requests', good)).body
    const stranger = await customer()
    assert.equal((await stranger.c.post('/api/conversations', body({ category: 'request', requestId: req.id }))).status, 422)
    const ok = await cu.c.post('/api/conversations', body({ category: 'request', requestId: req.id }))
    assert.equal(ok.status, 201); assert.equal(ok.body.requestId, req.id)
    const v = await ve.c.post('/api/conversations', body({ category: 'request', requestId: req.id, orderId: 'x' }))
    assert.equal(v.status, 201); assert.equal(v.body.requestId, null, 'vendors are never linked to a customer’s request')
  })
  it('staff reply, keep internal notes private, and set whose turn it is', async () => {
    const cu = await customer()
    const t = (await cu.c.post('/api/conversations', body())).body
    assert.equal(t.status, 'open')
    assert.equal((await cu.c.post(`/api/admin/conversations/${t.id}/messages`, { message: 'hi' })).status, 403)
    const rep = await admin.post(`/api/admin/conversations/${t.id}/messages`, { message: 'We can change the colour.' })
    assert.equal(rep.body.status, 'pending')
    await admin.post(`/api/admin/conversations/${t.id}/messages`, { message: 'Customer seems VIP, be nice', internal: true })
    const asCustomer = (await cu.c.get(`/api/conversations/${t.id}`)).body
    assert.equal(asCustomer.messages.length, 2, 'internal note hidden from the customer')
    assert.ok(!JSON.stringify(asCustomer).includes('VIP'))
    assert.equal((await admin.get(`/api/admin/conversations/${t.id}`)).body.messages.length, 3)
    assert.equal((await cu.c.post(`/api/conversations/${t.id}/messages`, { message: 'Thanks!' })).body.status, 'open')
  })
  it('staff start chats with a customer or a vendor, and can filter the inbox by role', async () => {
    const cu = await customer(), ve = await approvedVendor()
    const a = await admin.post('/api/admin/conversations', { requesterEmail: cu.u.email, subject: 'Your custom request', category: 'request', message: 'Anything to add?' })
    const b = await admin.post('/api/admin/conversations', { requesterEmail: ve.u.email, subject: 'A piece for you', category: 'request', message: 'Could you quote this?' })
    assert.equal(a.status, 201); assert.equal(a.body.requesterRole, 'customer'); assert.equal(a.body.status, 'pending')
    assert.equal(b.body.requesterRole, 'vendor')
    assert.equal((await cu.c.post('/api/admin/conversations', { requesterEmail: ve.u.email, subject: 'Direct to vendor', category: 'other', message: 'hello vendor' })).status, 403)
    assert.equal((await ve.c.post('/api/admin/conversations', { requesterEmail: cu.u.email, subject: 'Direct to client', category: 'other', message: 'hello client' })).status, 403)
    assert.equal((await admin.post('/api/admin/conversations', { requesterEmail: 'admin@karta.test', subject: 'Staff to staff', category: 'other', message: 'hello you' })).status, 422)
    const vendorsOnly = (await admin.get('/api/admin/conversations?role=vendor')).body.conversations
    assert.ok(vendorsOnly.length >= 1 && vendorsOnly.every((x: { requesterRole: string }) => x.requesterRole === 'vendor'))
  })
  it('closed chats stay closed for the requester; staff can reopen; open chats are capped', async () => {
    const cu = await customer()
    const t = (await cu.c.post('/api/conversations', body())).body
    await cu.c.post(`/api/conversations/${t.id}/close`)
    assert.equal((await cu.c.post(`/api/conversations/${t.id}/messages`, { message: 'still there?' })).status, 409)
    assert.equal((await admin.post(`/api/admin/conversations/${t.id}/status`, { status: 'open' })).body.status, 'open')
    for (let i = 0; i < 4; i++) assert.equal((await cu.c.post('/api/conversations', body({ subject: `Another question ${i}` }))).status, 201)
    assert.equal((await cu.c.post('/api/conversations', body({ subject: 'One too many' }))).status, 409)
  })
})

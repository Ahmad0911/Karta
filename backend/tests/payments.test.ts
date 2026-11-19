import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { after, before, describe, it } from 'node:test'

import type { PaystackClient, PaystackVerify } from '../src/platform/paystack.ts'
import { ORIGIN, signUp, start, verify, type Client, type Harness } from './harness.ts'

const SECRET = 'sk_test_unit_test_secret'
const RETURN = `${ORIGIN}/checkout/return`

/** A stand-in for Paystack: tests decide what it "says" happened. */
class FakePaystack implements PaystackClient {
  results = new Map<string, PaystackVerify>()
  refunds: { reference: string; amountKobo: number }[] = []
  refundStatus: 'pending' | 'completed' | 'failed' = 'completed'
  async initialize(i: { email: string; amountKobo: number; reference: string; callbackUrl: string }) {
    return { authorizationUrl: `https://checkout.paystack.test/${i.reference}`, reference: i.reference }
  }
  async verify(reference: string) { return this.results.get(reference) ?? { status: 'pending' as const, amountKobo: 0, currency: 'NGN', reference } }
  async refund(i: { reference: string; amountKobo: number }) { this.refunds.push(i); return { status: this.refundStatus, reference: i.reference } }
  says(reference: string, status: PaystackVerify['status'], amountKobo: number, currency = 'NGN') { this.results.set(reference, { status, amountKobo, currency, reference }) }
}

let h: Harness
let ps: FakePaystack
let admin: Client
let vendorEmail: string
const sign = (raw: string) => createHmac('sha512', SECRET).update(raw).digest('hex')
const stockOf = (id: string) => (h.deps.db.prepare('SELECT stock FROM listings WHERE id = ?').get(id) as { stock: number }).stock

before(async () => {
  ps = new FakePaystack()
  h = await start({ PAYSTACK_SECRET_KEY: SECRET }, { paystack: ps })
  admin = await h.makeAdmin()
  const v = await signUp(h, { role: 'vendor', businessName: 'Ade Woodworks' })
  vendorEmail = v.u.email
})
after(async () => { await h.close() })

let listingN = 0
async function listing(priceKobo = 1_000_000, stock = 5) {
  const id = `lst_${++listingN}`
  assert.equal((await admin.put(`/api/admin/listings/${id}`, { vendorEmail, name: 'Walnut table', priceKobo, stock, status: 'live' })).status, 200)
  return id
}
async function buyer() {
  const b = await signUp(h)
  await verify(h, b.c, 'phone', b.u.phone as string)
  return b
}
const ship = { state: 'FCT (Abuja)', city: 'Abuja', address: '12 Example Street, Wuse' }
async function order(c: Client, listingId: string, qty = 1) {
  const r = await c.post('/api/orders', { lines: [{ listingId, qty }], ship })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return r.body as { id: string; totalKobo: number }
}
async function init(c: Client, orderId: string) {
  const r = await c.post('/api/payments/initialize', { orderId, returnUrl: RETURN })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body as { reference: string; checkoutUrl: string }
}

describe('orders are priced by the server', () => {
  it('ignores any price the browser sends, and adds server-side delivery', async () => {
    const id = await listing(1_000_000)
    const { c } = await buyer()
    const r = await c.post('/api/orders', { lines: [{ listingId: id, qty: 2, priceKobo: 1, unitPrice: 1 }], ship })
    assert.equal(r.status, 201)
    assert.equal(r.body.subtotalKobo, 2_000_000)
    assert.equal(r.body.deliveryKobo, 1_500_000)
    assert.equal(r.body.totalKobo, 3_500_000)
  })
  it('requires a verified phone, a customer role, stock, and a live listing', async () => {
    const id = await listing(500_000, 1)
    const raw = await signUp(h)
    assert.equal((await raw.c.post('/api/orders', { lines: [{ listingId: id, qty: 1 }], ship })).status, 403)
    const v = await signUp(h, { role: 'vendor', businessName: 'Other' })
    assert.equal((await v.c.post('/api/orders', { lines: [{ listingId: id, qty: 1 }], ship })).status, 403)
    const { c } = await buyer()
    assert.equal((await c.post('/api/orders', { lines: [{ listingId: id, qty: 2 }], ship })).status, 409)
    assert.equal((await c.post('/api/orders', { lines: [{ listingId: 'nope', qty: 1 }], ship })).status, 422)
  })
  it('only staff can publish prices', async () => {
    const { c } = await buyer()
    assert.equal((await c.put('/api/admin/listings/x', { vendorEmail, name: 'x', priceKobo: 100, stock: 1, status: 'live' })).status, 403)
  })
})

describe('initialising a payment', () => {
  it('needs sign-in, owns the order, and only returns to our own site', async () => {
    const id = await listing()
    const { c } = await buyer()
    const o = await order(c, id)
    assert.equal((await h.client().post('/api/payments/initialize', { orderId: o.id, returnUrl: RETURN })).status, 401)
    const other = await buyer()
    assert.equal((await other.c.post('/api/payments/initialize', { orderId: o.id, returnUrl: RETURN })).status, 404)
    assert.equal((await c.post('/api/payments/initialize', { orderId: o.id, returnUrl: 'https://evil.example/steal' })).status, 422)
    const ok = await init(c, o.id)
    assert.match(ok.checkoutUrl, /^https:\/\/checkout\.paystack\.test\/KRT-/)
  })
  it('never accepts an amount from the browser', async () => {
    const id = await listing(2_000_000)
    const { c } = await buyer()
    const o = await order(c, id)
    const r = await init(c, o.id)
    const row = h.deps.db.prepare('SELECT amount_kobo FROM payments WHERE reference = ?').get(r.reference) as { amount_kobo: number }
    assert.equal(row.amount_kobo, o.totalKobo)
  })
  it('answers 503 when Paystack is not configured', async () => {
    const h2 = await start()
    try {
      const a = await h2.makeAdmin()
      const v = await signUp(h2, { role: 'vendor', businessName: 'Xyz Shop' })
      await a.put('/api/admin/listings/l', { vendorEmail: v.u.email, name: 'Test table', priceKobo: 100000, stock: 1, status: 'live' })
      const b = await signUp(h2); await verify(h2, b.c, 'phone', b.u.phone as string)
      const o = await b.c.post('/api/orders', { lines: [{ listingId: 'l', qty: 1 }], ship })
      assert.equal(o.status, 201, JSON.stringify(o.body))
      assert.equal((await b.c.post('/api/payments/initialize', { orderId: o.body.id, returnUrl: RETURN })).status, 503)
    } finally { await h2.close() }
  })
})

describe('confirming a payment', () => {
  it('a redirect alone proves nothing: pending until Paystack says success', async () => {
    const id = await listing(); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    const r = await c.get(`/api/payments/verify/${reference}`)
    assert.equal(r.body.status, 'pending')
    assert.equal((await c.get(`/api/orders/${o.id}`)).body.status, 'awaiting_payment')
  })
  it('marks the order paid and takes stock once, however many times it is checked', async () => {
    const id = await listing(1_000_000, 5); const { c } = await buyer()
    const o = await order(c, id, 2); const { reference } = await init(c, o.id)
    ps.says(reference, 'success', o.totalKobo)
    for (let i = 0; i < 3; i++) assert.equal((await c.get(`/api/payments/verify/${reference}`)).body.status, 'paid')
    assert.equal((await c.get(`/api/orders/${o.id}`)).body.status, 'paid')
    assert.equal(stockOf(id), 3)
  })
  it('refuses to treat a short payment as paid', async () => {
    const id = await listing(); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    ps.says(reference, 'success', 100)
    assert.equal((await c.get(`/api/payments/verify/${reference}`)).body.status, 'failed')
    assert.equal((await c.get(`/api/orders/${o.id}`)).body.status, 'awaiting_payment')
    assert.equal(stockOf(id), 5)
    const flagged = h.deps.db.prepare("SELECT 1 FROM audit_log WHERE action = 'payment.amount_mismatch' AND entity_id = ?").get(reference)
    assert.ok(flagged)
  })
  it('refuses a payment in the wrong currency', async () => {
    const id = await listing(); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    ps.says(reference, 'success', o.totalKobo, 'USD')
    assert.equal((await c.get(`/api/payments/verify/${reference}`)).body.status, 'failed')
  })
  it('hides other people’s payments and orders', async () => {
    const id = await listing(); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    const other = await buyer()
    assert.equal((await other.c.get(`/api/payments/verify/${reference}`)).status, 404)
    assert.equal((await other.c.get(`/api/orders/${o.id}`)).status, 404)
    assert.equal((await admin.get(`/api/orders/${o.id}`)).status, 200)
  })
})

describe('Paystack webhook', () => {
  const post = (body: unknown, sig?: string) => {
    const raw = JSON.stringify(body)
    // No browser headers at all, exactly like Paystack's servers.
    return h.client().post('/api/payments/webhook/paystack', undefined, { raw, csrf: false, headers: { 'x-paystack-signature': sig ?? sign(raw) } })
  }
  it('rejects a missing or forged signature', async () => {
    const raw = JSON.stringify({ event: 'charge.success', data: { reference: 'KRT-x' } })
    assert.equal((await h.client().post('/api/payments/webhook/paystack', undefined, { raw, csrf: false })).status, 401)
    assert.equal((await post({ event: 'charge.success', data: { reference: 'KRT-x' } }, 'f'.repeat(128))).status, 401)
  })
  it('settles a real charge.success, once, even if delivered repeatedly', async () => {
    const id = await listing(1_000_000, 4); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    ps.says(reference, 'success', o.totalKobo)
    for (let i = 0; i < 3; i++) assert.equal((await post({ event: 'charge.success', data: { reference } })).status, 200)
    assert.equal((await c.get(`/api/orders/${o.id}`)).body.status, 'paid')
    assert.equal(stockOf(id), 3)
  })
  it('does not trust the webhook body: Paystack is asked again', async () => {
    const id = await listing(); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    ps.says(reference, 'pending', 0)
    await post({ event: 'charge.success', data: { reference, amount: o.totalKobo, status: 'success' } })
    assert.equal((await c.get(`/api/orders/${o.id}`)).body.status, 'awaiting_payment')
  })
  it('ignores unknown references politely', async () => {
    assert.equal((await post({ event: 'charge.success', data: { reference: 'KRT-nobody' } })).status, 200)
  })
})

describe('refunds', () => {
  async function paid(priceKobo = 1_000_000) {
    const id = await listing(priceKobo); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    ps.says(reference, 'success', o.totalKobo)
    await c.get(`/api/payments/verify/${reference}`)
    return { c, o, reference }
  }
  it('is staff only', async () => {
    const { c, reference } = await paid()
    assert.equal((await c.post('/api/payments/refund', { reference, amountKobo: 100000, note: 'please' })).status, 403)
    assert.equal((await h.client().post('/api/payments/refund', { reference, amountKobo: 100000, note: 'please' })).status, 401)
  })
  it('refunds, tracks the running total, and never exceeds what was paid', async () => {
    const { c, o, reference } = await paid()
    ps.refundStatus = 'completed'
    assert.equal((await admin.post('/api/payments/refund', { reference, amountKobo: 1_000_000, note: 'Item returned' })).body.status, 'completed')
    assert.equal((await c.get(`/api/orders/${o.id}`)).body.refundedKobo, 1_000_000)
    const tooMuch = await admin.post('/api/payments/refund', { reference, amountKobo: o.totalKobo, note: 'Too much' })
    assert.equal(tooMuch.status, 422)
    assert.equal(ps.refunds.at(-1)!.amountKobo, 1_000_000)
  })
  it('cannot refund an unpaid payment', async () => {
    const id = await listing(); const { c } = await buyer()
    const o = await order(c, id); const { reference } = await init(c, o.id)
    assert.equal((await admin.post('/api/payments/refund', { reference, amountKobo: 100000, note: 'Nothing paid' })).status, 409)
  })
})

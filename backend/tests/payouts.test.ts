import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { insertUser } from '../src/modules/auth/users.ts'
import { hashPassword, newId } from '../src/platform/crypto.ts'
import type { PaystackClient, PaystackVerify } from '../src/platform/paystack.ts'
import { ORIGIN, PASSWORD, signUp, start, uniqueEmail, verify, type Client, type Harness } from './harness.ts'

class FakePaystack implements PaystackClient {
  results = new Map<string, PaystackVerify>()
  async initialize(i: { reference: string }) { return { authorizationUrl: `https://checkout.paystack.test/${i.reference}`, reference: i.reference } }
  async verify(reference: string) { return this.results.get(reference) ?? { status: 'pending' as const, amountKobo: 0, currency: 'NGN', reference } }
  async refund() { return { status: 'completed' as const } }
}
let h: Harness, ps: FakePaystack, admin: Client, driver: Client
const BANK = { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ade Okafor' }
const ship = { state: 'FCT (Abuja)', city: 'Abuja', address: '12 Example Street, Wuse' }
const DAY = 86_400_000

before(async () => {
  ps = new FakePaystack(); h = await start({ PAYSTACK_SECRET_KEY: 'sk_test_abc123' }, { paystack: ps }); admin = await h.makeAdmin()
  const email = uniqueEmail('driver')
  insertUser(h.deps.db, { id: newId(), email, name: 'Driver Dan', role: 'logistics', passwordHash: await hashPassword(PASSWORD, h.deps.config.scryptN), emailVerifiedAt: new Date().toISOString(), now: new Date().toISOString() })
  driver = h.client(); await driver.post('/api/auth/login', { email, password: PASSWORD })
})
after(async () => { await h.close() })

async function vendor(name: string, bank: object | null = BANK) {
  const v = await signUp(h, { role: 'vendor', businessName: name })
  h.deps.db.prepare('INSERT INTO vendor_applications (id,user_id,status,business,contact,payout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(`app_${v.user.id}`, v.user.id, 'approved', '{}', '{}', JSON.stringify(bank ?? {}), new Date().toISOString(), new Date().toISOString())
  return v
}
async function listing(v: { c: Client }, over: Record<string, unknown> = {}) {
  const id = (await v.c.post('/api/vendor/listings', { name: 'Walnut sofa' })).body.id
  await v.c.put(`/api/vendor/listings/${id}`, { categoryId: 'sofas', room: 'living', description: 'A three-seater curved sofa with solid walnut legs and a washable linen cover.', material: 'Walnut', dimensions: '210 × 95 cm', priceKobo: 10_000_000, stock: 20, images: ['https://cdn.karta.test/a.jpg'], ...over })
  await v.c.post(`/api/vendor/listings/${id}/submit`); await admin.post(`/api/admin/listings/${id}/review`, { decision: 'approve' })
  return id as string
}
async function buyer() { const b = await signUp(h); await verify(h, b.c, 'phone', b.u.phone as string); return b }
async function pay(b: { c: Client }, lines: object[]) {
  const o = await b.c.post('/api/orders', { lines, ship }); assert.equal(o.status, 201, JSON.stringify(o.body))
  const p = (await b.c.post('/api/payments/initialize', { orderId: o.body.id, returnUrl: `${ORIGIN}/x` })).body
  ps.results.set(p.reference, { status: 'success', amountKobo: o.body.totalKobo, currency: 'NGN', reference: p.reference })
  await b.c.get(`/api/payments/verify/${p.reference}`)
  return { order: o.body, reference: p.reference as string }
}
/** Take the vendor's order all the way to delivered, then make it `days` days old. */
async function deliver(v: { c: Client }, days: number) {
  const vo = (await v.c.get('/api/vendor/orders')).body.orders.at(0)
  for (let i = 0; i < 3; i++) await v.c.post(`/api/vendor/orders/${vo.id}/advance`)
  await driver.post(`/api/logistics/orders/${vo.id}/status`, { to: 'with_logistics' }); await driver.post(`/api/logistics/orders/${vo.id}/status`, { to: 'delivered' })
  h.deps.db.prepare('UPDATE vendor_orders SET delivered_at = ? WHERE id = ?').run(new Date(Date.now() - days * DAY).toISOString(), vo.id)
  return vo.id as string
}
const due = async (vendorId: string) => ((await admin.get('/api/admin/payouts/due')).body.vendors as { vendorId: string }[]).find((x) => x.vendorId === vendorId) as undefined | { amountKobo: number; canPay: boolean; orders: unknown[]; heldForReview: unknown[] }

describe('assembly fee (charged by the server)', () => {
  it('adds ₦15,000 per unit where the maker offers assembly, and nobody can dodge or invent it', async () => {
    const v = await vendor('Assembly Shop'); const withA = await listing(v, { assemblyAvailable: true }); const without = await listing(v, { name: 'x' })
    const b = await buyer()
    const o = await b.c.post('/api/orders', { lines: [{ listingId: withA, qty: 2, assembly: true }], ship })
    assert.equal(o.status, 201)
    assert.equal(o.body.subtotalKobo, 20_000_000); assert.equal(o.body.assemblyKobo, 3_000_000); assert.equal(o.body.deliveryKobo, 1_500_000)
    assert.equal(o.body.totalKobo, 24_500_000); assert.equal(o.body.lines[0].assembly, true)
    const none = await b.c.post('/api/orders', { lines: [{ listingId: withA, qty: 1 }], ship })
    assert.equal(none.body.assemblyKobo, 0); assert.equal(none.body.lines[0].assembly, false)
    assert.equal((await b.c.post('/api/orders', { lines: [{ listingId: without, qty: 1, assembly: true }], ship })).status, 422)
  })
  it('the customer pays the assembly fee, but it is not part of the vendor’s earnings', async () => {
    const v = await vendor('Assembly Earnings'); const id = await listing(v, { assemblyAvailable: true }); const b = await buyer()
    const { order } = await pay(b, [{ listingId: id, qty: 1, assembly: true }])
    assert.equal(order.totalKobo, 10_000_000 + 1_500_000 + 1_500_000)
    const vo = (await v.c.get('/api/vendor/orders')).body.orders[0]
    assert.equal(vo.subtotalKobo, 10_000_000); assert.equal(vo.netEarningKobo, 9_000_000)
  })
})

describe('vendor payouts', () => {
  it('nothing is due until 7 days after delivery', async () => {
    const v = await vendor('Fresh Shop'); const id = await listing(v); const b = await buyer()
    await pay(b, [{ listingId: id, qty: 1 }]); await deliver(v, 2)
    assert.equal(await due(v.user.id), undefined)
    h.deps.db.prepare('UPDATE vendor_orders SET delivered_at = ? WHERE vendor_id = ?').run(new Date(Date.now() - 8 * DAY).toISOString(), v.user.id)
    const d = await due(v.user.id)
    assert.ok(d); assert.equal(d!.amountKobo, 9_000_000); assert.equal(d!.canPay, true)
  })
  it('only staff manage payouts', async () => {
    const v = await vendor('Guarded Shop')
    for (const [m, path] of [['get', '/api/admin/payouts/due'], ['get', '/api/admin/payouts'], ['post', '/api/admin/payouts']] as const) assert.equal((await v.c[m](path)).status, 403)
    assert.equal((await h.client().get('/api/admin/payouts/due')).status, 401)
  })
  it('create → vendor sees nothing yet → mark paid → vendor sees it and the order is marked paid', async () => {
    const v = await vendor('Paid Shop'); const id = await listing(v); const b = await buyer()
    await pay(b, [{ listingId: id, qty: 1 }]); const voId = await deliver(v, 9)
    const p = await admin.post('/api/admin/payouts', { vendorId: v.user.id })
    assert.equal(p.status, 201); assert.equal(p.body.amountKobo, 9_000_000); assert.equal(p.body.status, 'pending'); assert.match(p.body.reference, /^PAY-\d+$/)
    assert.equal(p.body.bankLabel, 'GTBank ••••6789')
    assert.deepEqual((await v.c.get('/api/vendor/payouts')).body.payouts, [], 'not shown until the money is actually sent')
    assert.equal((await v.c.get('/api/vendor/orders')).body.orders[0].payoutId, null)
    assert.equal((await admin.post(`/api/admin/payouts/${p.body.id}/paid`, { transferRef: 'ab' })).status, 422)
    const paid = await admin.post(`/api/admin/payouts/${p.body.id}/paid`, { transferRef: 'TRF-20261127-0001' })
    assert.equal(paid.body.status, 'paid')
    const list = (await v.c.get('/api/vendor/payouts')).body.payouts
    assert.equal(list.length, 1); assert.equal(list[0].amountKobo, 9_000_000); assert.deepEqual(list[0].orderIds, [voId])
    assert.ok(!JSON.stringify(list).includes('0123456789'), 'the vendor’s list shows only the masked account')
    assert.equal((await v.c.get('/api/vendor/orders')).body.orders[0].payoutId, p.body.id)
    assert.equal((await admin.post(`/api/admin/payouts/${p.body.id}/paid`, { transferRef: 'TRF-AGAIN-0002' })).status, 409, 'cannot be paid twice')
    assert.equal((await admin.post(`/api/admin/payouts/${p.body.id}/cancel`, { reason: 'Changed my mind' })).status, 409, 'a paid one is a record')
  })
  it('the same delivery can never be paid twice', async () => {
    const v = await vendor('Once Shop'); const id = await listing(v); const b = await buyer()
    await pay(b, [{ listingId: id, qty: 1 }]); await deliver(v, 9)
    assert.equal((await admin.post('/api/admin/payouts', { vendorId: v.user.id })).status, 201)
    assert.equal((await admin.post('/api/admin/payouts', { vendorId: v.user.id })).status, 409)
    assert.equal(await due(v.user.id), undefined)
  })
  it('cancelling a pending payout puts the money back in "due"', async () => {
    const v = await vendor('Cancel Shop'); const id = await listing(v); const b = await buyer()
    await pay(b, [{ listingId: id, qty: 1 }]); await deliver(v, 9)
    const p = (await admin.post('/api/admin/payouts', { vendorId: v.user.id })).body
    assert.equal(await due(v.user.id), undefined)
    assert.equal((await admin.post(`/api/admin/payouts/${p.id}/cancel`, { reason: 'Wrong bank details' })).body.status, 'cancelled')
    assert.equal((await due(v.user.id))!.amountKobo, 9_000_000)
  })
  it('a vendor without a complete bank account cannot be paid, and the page says why', async () => {
    const v = await vendor('No Bank Shop', { bankName: 'GTBank', accountNumber: '123', accountName: 'X' }); const id = await listing(v); const b = await buyer()
    await pay(b, [{ listingId: id, qty: 1 }]); await deliver(v, 9)
    assert.equal((await due(v.user.id))!.canPay, false)
    assert.equal((await admin.post('/api/admin/payouts', { vendorId: v.user.id })).status, 422)
  })
  it('a refunded order is held for review instead of being paid out', async () => {
    const v = await vendor('Refunded Shop'); const id = await listing(v); const b = await buyer()
    const { reference } = await pay(b, [{ listingId: id, qty: 1 }]); await deliver(v, 9)
    assert.equal((await admin.post('/api/payments/refund', { reference, amountKobo: 500_000, note: 'Scratched leg, partial refund' })).status, 200)
    const d = await due(v.user.id)
    assert.equal(d!.amountKobo, 0); assert.equal(d!.heldForReview.length, 1); assert.equal(d!.canPay, false)
    assert.equal((await admin.post('/api/admin/payouts', { vendorId: v.user.id })).status, 409)
  })
  it('history lists every payout with the account it went to, for staff', async () => {
    const all = (await admin.get('/api/admin/payouts')).body.payouts as { accountNumber: string; vendorName: string; status: string }[]
    assert.ok(all.length >= 3); assert.ok(all.every((p) => p.accountNumber && p.vendorName))
    assert.ok(((await admin.get('/api/admin/payouts?status=paid')).body.payouts as { status: string }[]).every((p) => p.status === 'paid'))
  })
})

describe('refund screen data', () => {
  it('admin orders carry the payment reference and say what needs attention', async () => {
    const v = await vendor('Attention Shop'); const id = await listing(v); const b = await buyer()
    const { order, reference } = await pay(b, [{ listingId: id, qty: 1 }])
    const vo = (await v.c.get('/api/vendor/orders')).body.orders[0]
    await v.c.post(`/api/vendor/orders/${vo.id}/decline`, { reason: 'Our workshop is closed this month.' })
    const row = ((await admin.get('/api/admin/orders')).body.orders as { id: string; paymentReference: string; attention: { kind: string; refundDueKobo?: number }[] }[]).find((o) => o.id === order.id)!
    assert.equal(row.paymentReference, reference)
    assert.ok(row.attention.some((a) => a.kind === 'vendor_declined' && a.refundDueKobo === 10_000_000))
    assert.equal((await admin.post('/api/payments/refund', { reference, amountKobo: 10_000_000, note: 'Vendor declined the order' })).body.status, 'completed')
  })
})

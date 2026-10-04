// Run with KARTA_DEV=1
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const { useAuthStore } = await import('@/store/auth.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const { useRequestsStore } = await import('@/modules/requests/requests.store')
const { useOrdersStore } = await import('@/modules/orders/orders.store')
const { containsContactInfo, LIMITS } = await import('@/modules/requests/lib')
const pay = await import('@/modules/payments/providers/mock')
const { toKobo } = await import('@/modules/payments/types')
const { vendorIdFor } = await import('@/modules/catalog/vendorId')

const as = u => useAuthStore.setState({ user: u, isAuthenticated: !!u })
const Q = () => useRequestsStore.getState(), V = () => useVendorStore.getState(), O = () => useOrdersStore.getState()
const cust = { id: 'c', name: 'Chidinma Okafor', email: 'chidinma@mail.com', role: 'customer', phone: '08052345678', phoneVerified: true }
const stranger = { id: 's', name: 'Stranger', email: 'stranger@mail.com', role: 'customer', phoneVerified: true }
const mk = (email, name) => ({ id: email, name, email, role: 'vendor' })
const v1 = mk('ade@shop.ng', 'Ade'), v2 = mk('bola@shop.ng', 'Bola'), v3 = mk('chuka@shop.ng', 'Chuka'), pending = mk('new@shop.ng', 'New')
const admin = { id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' }
for (const [u, st] of [[v1, 'approved'], [v2, 'approved'], [v3, 'approved'], [pending, 'under_review']]) {
  V().ensureWorkspace(u)
  useVendorStore.setState(s => ({ byEmail: { ...s.byEmail, [u.email]: { ...s.byEmail[u.email], profile: { ...s.byEmail[u.email].profile, status: st, business: { ...s.byEmail[u.email].profile.business, name: u.name + ' Woodworks' } } } } }))
}

console.log('\nKeeping deals on Karta')
for (const bad of ['call me on 0803 123 4567', 'my number is +234 803 123 4567', 'email me at ade@gmail.com', 'ade at gmail dot com', 'see www.mysite.com', 'message me on whatsapp', 'dm me', 'ade@shop(dot)ng'])
  ok(`blocks: "${bad}"`, containsContactInfo(bad))
for (const fine of ['A walnut sofa, 220cm wide, in sand fabric', 'I need 6 chairs by 15 June', 'Budget about 450000 naira', 'The table seats 8 people'])
  ok(`allows: "${fine}"`, !containsContactInfo(fine))

console.log('\nPosting a request')
const good = { title: 'Curved walnut sofa in sand bouclé', description: 'I want a three-seater curved sofa like the photo, with walnut legs and washable cover.', styles: ['Modern'], city: 'Abuja', state: 'FCT (Abuja)', images: ['data:image/jpeg;base64,AAA'], budgetMin: 300000, budgetMax: 600000 }
as(null); ok('signed-out cannot post', Q().create(good).ok === false)
as({ ...cust, phoneVerified: false }); ok('unverified phone cannot post', Q().create(good).ok === false)
as(cust)
ok('short title refused', Q().create({ ...good, title: 'Sofa' }).ok === false)
ok('thin description refused', Q().create({ ...good, description: 'a sofa' }).ok === false)
ok('contact details in description refused', Q().create({ ...good, description: 'Curved sofa please, call me on 08031234567 to discuss' }).ok === false)
ok('contact details in title refused', Q().create({ ...good, title: 'Sofa, email me ade@x.com' }).ok === false)
ok('missing delivery area refused', Q().create({ ...good, state: '' }).ok === false)
ok('max > min budget enforced', Q().create({ ...good, budgetMin: 500000, budgetMax: 300000 }).ok === false)
ok('5 images refused', Q().create({ ...good, images: ['a', 'b', 'c', 'd', 'e'] }).ok === false)
const r = Q().create(good)
ok('valid request opens', r.ok && r.data.status === 'open' && /^REQ-\d+$/.test(r.data.number))
ok('vendors see first name + initial only (no email/phone)', r.data.customerLabel === 'Chidinma O.' && !JSON.stringify({ ...r.data, customerEmail: 0 }).includes('chidinma@'))
Q().create({ ...good, title: 'Second piece I need' }); Q().create({ ...good, title: 'Third piece I need' })
ok(`max ${LIMITS.maxActive} active requests`, Q().create({ ...good, title: 'Fourth piece I need' }).ok === false)

console.log('\nVendors make offers')
const offer = { price: 450000, days: 21, note: 'I can build this in solid walnut with a washable cover.' }
const id = r.data.id
as(cust); ok('customers cannot make offers', Q().offer(id, offer).ok === false)
as(pending); ok('UNVERIFIED vendors cannot make offers', Q().offer(id, offer).ok === false)
as(v1)
ok('price below ₦1,000 refused', Q().offer(id, { ...offer, price: 500 }).ok === false)
ok('days must be 1–180', Q().offer(id, { ...offer, days: 0 }).ok === false && Q().offer(id, { ...offer, days: 400 }).ok === false)
ok('contact details in the note refused', Q().offer(id, { ...offer, note: 'WhatsApp me and I will quote you cheaper' }).ok === false)
ok('thin note refused', Q().offer(id, { ...offer, note: 'ok' }).ok === false)

console.log('\nFirst vendor wins')
as(v1); const a = Q().offer(id, offer)
as(v2); const b = Q().offer(id, { ...offer, price: 400000 })
ok('first vendor claims it', a.ok)
ok('second vendor is told it is taken', !b.ok && /already taken/.test(b.error), b.error)
const rq = () => Q().requests.find(x => x.id === id)
ok('request is now "claimed" by the first vendor', rq().status === 'claimed' && rq().offer.vendorEmail === 'ade@shop.ng' && rq().offer.price === 450000)
ok('offer shows a 72-hour deadline', Math.abs(+new Date(rq().offer.expiresAt) - Date.now() - 72 * 3600_000) < 5000)

console.log('\nCustomer decides')
as(stranger); ok('another customer cannot answer it', Q().respond(id, 'accept').ok === false)
as(v1); ok('the vendor cannot accept their own offer', Q().respond(id, 'accept').ok === false)
as(cust)
ok('customer declines → request reopens', Q().respond(id, 'decline').ok && rq().status === 'open' && !rq().offer)
as(v1); ok('declined vendor CANNOT claim it again', Q().offer(id, offer).ok === false)
as(v2); ok('another vendor can now claim it', Q().offer(id, { ...offer, price: 400000, days: 14 }).ok)
as(v2); ok('vendor can withdraw, which also bars them', Q().withdraw(id).ok && rq().status === 'open' && Q().offer(id, offer).ok === false)
as(v3); ok('a third vendor claims it', Q().offer(id, { ...offer, price: 380000, days: 18 }).ok)

console.log('\nExpiry')
useRequestsStore.setState(s => ({ requests: s.requests.map(x => x.id === id ? { ...x, offer: { ...x.offer, expiresAt: new Date(Date.now() - 1000).toISOString() } } : x) }))
as(cust); ok('answering an expired offer is refused', Q().respond(id, 'accept').ok === false)
Q().sweep()
ok('sweep reopens a timed-out offer and bars that vendor', rq().status === 'open' && rq().declinedBy.includes('chuka@shop.ng'))
as(v1); ok('…but v1 was declined earlier, so still barred', Q().offer(id, offer).ok === false)

console.log('\nAccepting → a private piece')
// fresh request with a new vendor pool
as(cust); Q().close(id)
const r2 = Q().create({ ...good, title: 'Oak bookshelf, floor to ceiling' }).data
as(v1); Q().offer(r2.id, { price: 250000, days: 30, note: 'Solid oak with adjustable shelves, finished by hand.' })
as(cust)
ok('customer accepts', Q().respond(r2.id, 'accept').ok)
const q2 = () => Q().requests.find(x => x.id === r2.id)
const lst = V().byEmail['ade@shop.ng'].listings.find(l => l.id === q2().offer.listingId)
ok('private listing created for the vendor, live, stock 1', lst && lst.status === 'live' && lst.stock === 1 && lst.price === 250000)
ok('listing is locked to this customer', lst.custom.customerEmail === 'chidinma@mail.com' && lst.custom.requestId === r2.id)
ok('delivery time = the vendor’s promised days', lst.deliveryMinDays === 30 && lst.deliveryMaxDays === 30)
ok('listing carries the customer’s reference images', lst.images.length === 1)
as(v1)
ok('vendor cannot edit the agreed piece (price etc.)', V().saveListing('ade@shop.ng', { id: lst.id, draft: { ...lst, price: 999999 }, submitForReview: true }).ok === false)
// catalog visibility rule
const visibleTo = (email) => !lst.custom || lst.custom.customerEmail === email
ok('buyer can see it', visibleTo('chidinma@mail.com'))
ok('NOBODY else can see it', !visibleTo('stranger@mail.com') && !visibleTo('bola@shop.ng'))

console.log('\nPaying completes the request')
const getProduct = pid => pid === lst.id ? { id: pid, name: lst.name, price: lst.price, inStock: true, assemblyAvailable: false, vendor: { id: vendorIdFor('ade@shop.ng'), name: 'Ade Woodworks', trustScore: 60 } } : undefined
as(cust)
const o = O().createPendingOrder({ customerEmail: cust.email, customerName: cust.name, address: { fullName: 'C O', phone: '08052345678', street: '14 Gana Street', city: 'Abuja', state: 'FCT (Abuja)' }, items: [{ productId: lst.id, qty: 1, assembly: false }], getProduct, ownerEmail: () => 'ade@shop.ng' })
ok('order can be created', o.ok)
const s = await pay.mockProvider.initialize({ orderId: o.data.id, orderNumber: o.data.number, amountKobo: toKobo(o.data.total), currency: 'NGN', customerEmail: cust.email, customerName: cust.name, returnUrl: '/' })
pay.mockGatewayRespond(s.reference, 'paid'); const vv = await pay.mockProvider.verify(s.reference)
O().markPaid(o.data.id, { provider: 'mock', reference: s.reference, paidAmountKobo: vv.paidAmountKobo })
ok('request becomes "ordered"', q2().status === 'ordered')
ok('stock drops to 0, so nobody can buy it twice', V().byEmail['ade@shop.ng'].listings.find(l => l.id === lst.id).stock === 0)
ok('an ordered request cannot be closed', Q().close(r2.id).ok === false)

console.log('\nClosing + moderation')
as(cust); const r3 = Q().create({ ...good, title: 'Marble coffee table please' }).data
as(v1); Q().offer(r3.id, { price: 200000, days: 10, note: 'Carrara marble top with brass legs.' })
as(cust); Q().respond(r3.id, 'accept')
const l3 = V().byEmail['ade@shop.ng'].listings.find(l => l.custom?.requestId === r3.id)
ok('closing an accepted request retires the private listing', Q().close(r3.id).ok && V().byEmail['ade@shop.ng'].listings.find(l => l.id === l3.id).stock === 0)
// age earlier requests so today's posting limit (5) isn't what this section tests
useRequestsStore.setState(st => ({ requests: st.requests.map(x => ({ ...x, createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString() })) }))
as(cust); const r4 = Q().create({ ...good, title: 'Something inappropriate here' }).data
as(cust); ok('customer cannot remove via admin route', Q().adminRemove(r4.id, 'because I said so please').ok === false)
as(admin)
ok('admin must give a reason', Q().adminRemove(r4.id, 'no').ok === false)
ok('admin removes a request with a reason', Q().adminRemove(r4.id, 'Contains abusive language').ok && Q().requests.find(x => x.id === r4.id).status === 'removed')
as(v1); ok('removed requests cannot be claimed', Q().offer(r4.id, offer).ok === false)

console.log('\nVendors cannot hoard requests')
const ids = []
for (let i = 0; i < 6; i++) {
  const c = { id: 'm' + i, name: 'Buyer ' + i, email: `buyer${i}@mail.com`, role: 'customer', phoneVerified: true }
  as(c); ids.push(Q().create({ ...good, title: `Hoard test request ${i}` }).data.id)
}
as(v3)
const results = ids.map(rid => Q().offer(rid, { price: 100000, days: 10, note: 'I can make this for you.' }))
ok('a vendor can hold 5 offers at once', results.slice(0, 5).every(r => r.ok))
ok('the 6th is refused until they get an answer', results[5].ok === false && /waiting/.test(results[5].error), results[5].error)
as({ id: 'm0', name: 'Buyer 0', email: 'buyer0@mail.com', role: 'customer', phoneVerified: true }); Q().respond(ids[0], 'decline')
as(v3); ok('…and can offer again once one is answered', Q().offer(ids[5], { price: 100000, days: 10, note: 'I can make this for you.' }).ok)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗ FAIL:', name, extra) } }

const { useAuthStore } = await import('@/store/auth.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const { useOrdersStore } = await import('@/modules/orders/orders.store')
const { useReviewsStore } = await import('@/modules/reviews/reviews.store')
const rev = await import('@/modules/reviews/lib')
const fraud = await import('@/modules/admin/lib/fraud')
const cat = await import('@/modules/catalog/useCatalog')
const pay = await import('@/modules/payments/providers/mock')
const { toKobo } = await import('@/modules/payments/types')
const ob = await import('@/modules/vendors/lib/onboarding')
const ls = await import('@/modules/vendors/lib/listings')

const as = (user) => useAuthStore.setState({ user, isAuthenticated: !!user })
const vendorUser = { id: 'v', name: 'Ade Bello', email: 'ade@shop.ng', phone: '08031234567', role: 'vendor', businessName: 'Ade Woodworks' }
const adminUser = { id: 'a', name: 'Admin One', email: 'admin@karta.test', role: 'admin' }
const buyer = { id: 'c', name: 'Chidinma Okafor', email: 'Chidinma@Mail.com', role: 'customer', phoneVerified: true }
const V = () => useVendorStore.getState()
const W = (e = 'ade@shop.ng') => V().byEmail[e]

console.log('\nVerification: nobody sells before an admin approves')
as(vendorUser)
useAuthStore.setState((s) => ({ accounts: { ...s.accounts, [vendorUser.email]: { user: { ...vendorUser, emailVerified: true, phoneVerified: true }, salt: 'x', hash: 'x' } } }))
V().ensureWorkspace(vendorUser)
const doc = k => ({ id: k, kind: k, fileName: k + '.pdf', sizeKb: 5, uploadedAt: new Date().toISOString() })
V().updateProfile(vendorUser.email, p => ({ ...p,
  business: { ...p.business, type: 'individual', description: 'Handmade hardwood furniture crafted in our Abuja workshop since 2012.', categoryIds: ['tables'], address: '12 Industrial Layout', city: 'Abuja', state: 'FCT (Abuja)' },
  payout: { bankName: 'Zenith Bank', accountNumber: '0123456789', accountName: 'Ade Bello' },
  documents: ['government_id', 'proof_of_address'].map(doc), agreedToTerms: true }))
ok('vendor submits application', V().submitApplication(vendorUser.email).ok)
ok('submission recorded in audit log', W().profile.verificationLog.at(-1).action === 'submitted')

const draft = { ...ls.emptyListingDraft(), name: 'Kano Dining Table', categoryId: 'tables', room: 'dining', description: 'Six-seater dining table in solid iroko with steel legs, finished by hand.', material: 'Iroko', dimensions: '180 × 90 × 75 cm', price: 420000, stock: 5, images: ['data:image/jpeg;base64,AAA'] }
ok('unverified vendor cannot submit a listing', V().saveListing(vendorUser.email, { draft, submitForReview: true }).ok === false)
ok('…but a draft is fine', V().saveListing(vendorUser.email, { draft: { ...draft, name: 'Draft table' }, submitForReview: false }).ok)

ok('VENDOR cannot approve themselves', V().decideApplication(vendorUser.email, 'approve', '', 60).ok === false)
ok('still under_review', W().profile.status === 'under_review')
as(buyer)
ok('CUSTOMER cannot approve a vendor', V().decideApplication(vendorUser.email, 'approve', '', 60).ok === false)
as(null)
ok('signed-out cannot approve', V().decideApplication(vendorUser.email, 'approve', '', 60).ok === false)

as(adminUser)
ok('admin: request_changes needs a real note', V().decideApplication(vendorUser.email, 'request_changes', 'fix', undefined).ok === false)
ok('admin: invalid trust score rejected', V().decideApplication(vendorUser.email, 'approve', '', 150).ok === false)
ok('admin: request changes works', V().decideApplication(vendorUser.email, 'request_changes', 'Please upload a clearer proof of address.').ok && W().profile.status === 'changes_requested')
ok('vendor is editable again', ob.isEditable(W().profile))
as(vendorUser)
ok('vendor resubmits', V().submitApplication(vendorUser.email).ok && W().profile.status === 'under_review')
as(adminUser)
ok('admin approves', V().decideApplication(vendorUser.email, 'approve', '', 60).ok && W().profile.status === 'approved')
ok('trust score set by admin', W().profile.trustScore === 60)
ok('cannot approve twice', V().decideApplication(vendorUser.email, 'approve', '', 60).ok === false)
ok('audit log has submitted→changes→submitted→approved', W().profile.verificationLog.map(e => e.action).join() === 'submitted,changes_requested,submitted,approved', W().profile.verificationLog.map(e => e.action).join())
ok('audit log records WHO decided', W().profile.verificationLog.at(-1).by === 'admin@karta.test')

console.log('\nListing moderation + storefront visibility')
as(vendorUser)
const saved = V().saveListing(vendorUser.email, { draft, submitForReview: true })
ok('verified vendor submits listing → in_review', saved.ok && saved.data.status === 'in_review')
const cat1 = () => {
  const byEmail = V().byEmail; const owners = new Map()
  const live = Object.entries(byEmail).flatMap(([email, w]) => w.listings.filter(l => cat.isSellable(w.profile, l)).map(l => (owners.set(l.id, email), l)))
  return { live, owners }
}
ok('in_review listing is NOT sellable', cat1().live.length === 0)
ok('vendor cannot moderate own listing', V().moderateListing(vendorUser.email, saved.data.id, 'approve', '').ok === false)
as(adminUser)
ok('rejecting needs a reason', V().moderateListing(vendorUser.email, saved.data.id, 'reject', 'no').ok === false)
ok('admin approves listing', V().moderateListing(vendorUser.email, saved.data.id, 'approve', '').ok)
ok('approved listing from verified vendor IS sellable', cat1().live.length === 1)
ok('admin suspends vendor', V().decideApplication(vendorUser.email, 'suspend', 'Customer complaints under investigation.').ok)
ok('SUSPENDED vendor’s live listing disappears from storefront', cat1().live.length === 0)
ok('suspended vendor cannot submit listings', (as(vendorUser), V().saveListing(vendorUser.email, { draft, submitForReview: true }).ok === false))
as(adminUser)
ok('admin reinstates', V().decideApplication(vendorUser.email, 'reinstate', '').ok && cat1().live.length === 1)

console.log('\nFraud signals')
const second = { id: 'v2', name: 'Zed Scam', email: 'zed@x.com', phone: '0803 123 4567', role: 'vendor', businessName: 'Ade Woodworks' }
as(second); V().ensureWorkspace(second)
V().updateProfile(second.email, p => ({ ...p, payout: { bankName: 'Zenith Bank', accountNumber: '0123456789', accountName: 'Random Person' }, business: { ...p.business, name: 'Ade Woodworks' } }))
const all = Object.entries(V().byEmail).map(([email, workspace]) => ({ email, workspace }))
const sig = fraud.signalsFor(all.find(v => v.email === 'zed@x.com'), all)
ok('flags shared phone', sig.some(s => /Same phone/.test(s.text)))
ok('flags shared bank account', sig.some(s => /Same bank account/.test(s.text)))
ok('flags account-name mismatch', sig.some(s => /doesn’t resemble/.test(s.text)))
const clean = fraud.signalsFor(all.find(v => v.email === 'ade@shop.ng'), all)
ok('legit vendor (name matches) has no mismatch flag', !clean.some(s => /doesn’t resemble/.test(s.text)))

console.log('\nPayments + orders')
const O = () => useOrdersStore.getState()
const getProduct = id => id === saved.data.id
  ? { id, name: draft.name, price: 420000, inStock: true, assemblyAvailable: true, vendor: { id: cat.vendorIdFor('ade@shop.ng'), name: 'Ade Woodworks', trustScore: 60 } }
  : undefined
const ownerEmail = id => id === saved.data.id ? 'ade@shop.ng' : undefined
const addr = { fullName: 'Chidinma Okafor', phone: '08052345678', street: '14 Gana Street, Maitama', city: 'Abuja', state: 'FCT (Abuja)' }
as(buyer)
ok('empty cart rejected', O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: addr, items: [], getProduct, ownerEmail }).ok === false)
ok('bad phone rejected', O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: { ...addr, phone: '123' }, items: [{ productId: saved.data.id, qty: 1, assembly: false }], getProduct, ownerEmail }).ok === false)
ok('cannot buy more than stock', O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: addr, items: [{ productId: saved.data.id, qty: 99, assembly: false }], getProduct, ownerEmail }).ok === false)
ok('unknown product rejected', O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: addr, items: [{ productId: 'nope', qty: 1, assembly: false }], getProduct, ownerEmail }).ok === false)

const created = O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: addr, items: [{ productId: saved.data.id, qty: 2, assembly: true }], getProduct, ownerEmail })
ok('pending order created', created.ok && created.data.status === 'pending_payment')
const ord = created.data
ok('total = items + assembly + FCT delivery', ord.total === 840000 + ord.assemblyFee + 15000 && ord.assemblyFee > 0, JSON.stringify([ord.subtotal, ord.assemblyFee, ord.deliveryFee, ord.total]))
ok('vendor sees NOTHING before payment', W().orders.length === 0)

const session = await pay.mockProvider.initialize({ orderId: ord.id, orderNumber: ord.number, amountKobo: toKobo(ord.total), currency: 'NGN', customerEmail: buyer.email, customerName: buyer.name, returnUrl: '/' })
ok('unpaid session verifies as pending', (await pay.mockProvider.verify(session.reference)).status === 'pending')
ok('markPaid refuses without a verified amount', O().markPaid(ord.id, { provider: 'mock', reference: session.reference }).ok === false)
ok('…and a wrong amount marks payment failed', O().orders.find(o => o.id === ord.id).payment.status === 'failed' || O().orders.find(o => o.id === ord.id).status !== 'paid')
// fresh order for the happy path
const c2 = O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: addr, items: [{ productId: saved.data.id, qty: 2, assembly: true }], getProduct, ownerEmail })
const o2 = c2.data
const s2 = await pay.mockProvider.initialize({ orderId: o2.id, orderNumber: o2.number, amountKobo: toKobo(o2.total), currency: 'NGN', customerEmail: buyer.email, customerName: buyer.name, returnUrl: '/' })
pay.mockGatewayRespond(s2.reference, 'paid')
const v2 = await pay.mockProvider.verify(s2.reference)
ok('provider verification says paid for the full amount', v2.status === 'paid' && v2.paidAmountKobo === toKobo(o2.total))
const paid = O().markPaid(o2.id, { provider: 'mock', reference: s2.reference, paidAmountKobo: v2.paidAmountKobo })
ok('order marked paid', paid.ok && paid.data.status === 'paid')
ok('vendor now has the order', W().orders.length === 1 && W().orders[0].status === 'new')
ok('vendor order excludes delivery/assembly fees', W().orders[0].subtotal === 840000)
ok('commission applied', W().orders[0].commission === 84000 && W().orders[0].netEarning === 756000)
ok('stock decremented 5 → 3', W().listings.find(l => l.id === saved.data.id).stock === 3)
O().markPaid(o2.id, { provider: 'mock', reference: s2.reference, paidAmountKobo: v2.paidAmountKobo })
ok('re-verifying is idempotent (no duplicate vendor order)', W().orders.length === 1 && W().listings.find(l => l.id === saved.data.id).stock === 3)
pay.mockGatewayRespond(s2.reference, 'failed')
ok('a settled payment cannot be flipped afterwards', (await pay.mockProvider.verify(s2.reference)).status === 'paid')

console.log('\nReviews')
const R = () => useReviewsStore.getState()
const vid = cat.vendorIdFor('ade@shop.ng')
as(buyer)
ok('cannot review before delivery', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 5, body: 'Excellent craftsmanship overall.' }).ok === false)
O().devMarkDelivered(o2.id)
ok('delivery marks vendor order delivered too', W().orders[0].status === 'delivered')
ok('rating 0 rejected', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 0, body: 'Excellent craftsmanship overall.' }).ok === false)
ok('rating 6 rejected', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 6, body: 'Excellent craftsmanship overall.' }).ok === false)
ok('too-short text rejected', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 5, body: 'good' }).ok === false)
ok('cannot review a vendor not in the order', R().submit({ orderId: o2.id, target: 'vendor', targetId: 'v1', rating: 5, body: 'Excellent craftsmanship overall.' }).ok === false)
ok('cannot review the wrong courier', R().submit({ orderId: o2.id, target: 'logistics', targetId: 'someone-else', rating: 5, body: 'Excellent delivery overall.' }).ok === false)
ok('buyer reviews vendor', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 5, body: 'Excellent craftsmanship overall.' }).ok)
ok('buyer reviews logistics', R().submit({ orderId: o2.id, target: 'logistics', targetId: 'karta-logistics', rating: 4, body: 'Arrived on time and careful.' }).ok)
ok('no duplicate review for same order', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 1, body: 'Changed my mind terribly.' }).ok === false)
ok('author shown as first name + initial only', R().reviews.find(r => r.target === 'vendor').authorLabel === 'Chidinma O.')
as({ id: 'x', name: 'Other Person', email: 'other@mail.com', role: 'customer' })
ok('a different customer cannot review someone else’s order', R().submit({ orderId: o2.id, target: 'vendor', targetId: vid, rating: 1, body: 'Fake negative review here.' }).ok === false)
const rid = R().reviews.find(r => r.target === 'vendor').id
ok('customer cannot hide reviews', R().setHidden(rid, true, 'because').ok === false)
ok('customer cannot reply as vendor', R().reply(rid, 'Thanks for nothing').ok === false)
as(vendorUser)
ok('vendor can reply', R().reply(rid, 'Thank you Chidinma, enjoy the table!').ok)
ok('only one reply', R().reply(rid, 'Another reply.').ok === false)
as(adminUser)
ok('admin hide needs reason', R().setHidden(rid, true, '').ok === false)
ok('admin hides with reason', R().setHidden(rid, true, 'Contains personal data').ok)
ok('hidden reviews excluded from summary', rev.summarize(R().reviews.filter(r => r.target === 'vendor')).count === 0)
R().setHidden(rid, false)
ok('unhide works', rev.summarize(R().reviews.filter(r => r.target === 'vendor')).count === 1)

console.log('\nRecommendations')
R().devLoadSamples()
const refs = [{ id: 'v1', name: 'Ade & Sons', trustScore: 92 }, { id: 'v2', name: 'Nsukka', trustScore: 88 }, { id: 'v3', name: 'Abuja Living', trustScore: 76 }, { id: 'v4', name: 'Zuri', trustScore: 63 }]
const recs = rev.recommendVendors(refs, R().reviews)
ok('best-reviewed, most-trusted vendor ranks first', recs[0].vendor.id === 'v1', recs.map(r => r.vendor.id + ':' + r.score.toFixed(2)).join())
ok('v1 recommended (4 reviews, 4.75 avg, trust 92)', recs.find(r => r.vendor.id === 'v1').recommended)
ok('v2 NOT yet recommended: 3 reviews is thin evidence even at 4.67★', !recs.find(r => r.vendor.id === 'v2').recommended)
const more = [...R().reviews, ...[5, 5, 4, 5].map((rating, i) => ({ id: 'x' + i, target: 'vendor', targetId: 'v2', rating, status: 'published' }))]
ok('v2 becomes recommended after 7 reviews averaging ~4.7', rev.evaluateVendor(refs[1], more).recommended)
ok('hidden reviews do not count toward recommendation', !rev.evaluateVendor(refs[1], more.map(r => ({ ...r, status: r.targetId === 'v2' ? 'hidden' : r.status }))).recommended)
ok('v3 NOT recommended (2 reviews)', !recs.find(r => r.vendor.id === 'v3').recommended)
ok('v4 NOT recommended (low trust, 1 review)', !recs.find(r => r.vendor.id === 'v4').recommended)
ok('one 5★ review does not beat many good ones', rev.bayesian(5, 1) < rev.bayesian(4.75, 4))
ok('vendor with no reviews gets prior, not NaN', Number.isFinite(rev.evaluateVendor({ id: 'zz', name: 'New', trustScore: 60 }, []).score))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

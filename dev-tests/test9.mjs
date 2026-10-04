// Run with KARTA_DEV=1
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const { useAuthStore } = await import('@/store/auth.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const { useOrdersStore } = await import('@/modules/orders/orders.store')
const { useReturnsStore } = await import('@/modules/returns/returns.store')
const lib = await import('@/modules/returns/lib')
const pay = await import('@/modules/payments/providers/mock')
const { toKobo } = await import('@/modules/payments/types')
const ls = await import('@/modules/vendors/lib/listings')
const cat = await import('@/modules/catalog/vendorId')

const as = u => useAuthStore.setState({ user: u, isAuthenticated: !!u })
const V = () => useVendorStore.getState(), O = () => useOrdersStore.getState(), R = () => useReturnsStore.getState()
const vendor = { id: 'v', name: 'Ade Bello', email: 'ade@shop.ng', phone: '08031234567', role: 'vendor', emailVerified: true, phoneVerified: true }
const other = { id: 'v2', name: 'Other Vendor', email: 'other@shop.ng', role: 'vendor' }
const admin = { id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' }
const buyer = { id: 'c', name: 'Chidinma Okafor', email: 'chidinma@mail.com', role: 'customer', phoneVerified: true }
const stranger = { id: 's', name: 'Stranger', email: 'stranger@mail.com', role: 'customer', phoneVerified: true }
const addr = { fullName: 'Chidinma Okafor', phone: '08052345678', street: '14 Gana Street, Maitama', city: 'Abuja', state: 'FCT (Abuja)' }

// ---- set up an approved vendor with a live listing, and a paid + delivered order of qty 2 ----
useAuthStore.setState(s => ({ accounts: { ...s.accounts, [vendor.email]: { user: vendor, salt: 'x', hash: 'x' } } }))
as(vendor); V().ensureWorkspace(vendor)
const doc = k => ({ id: k, kind: k, fileName: k + '.pdf', sizeKb: 5, uploadedAt: new Date().toISOString() })
V().updateProfile(vendor.email, p => ({ ...p, business: { ...p.business, name: 'Ade Woodworks', description: 'Handmade hardwood furniture crafted in our Abuja workshop since 2012.', categoryIds: ['tables'], address: '12 Industrial Layout', city: 'Abuja', state: 'FCT (Abuja)' }, payout: { bankName: 'Zenith Bank', accountNumber: '0123456789', accountName: 'Ade Bello' }, documents: ['government_id', 'proof_of_address'].map(doc), agreedToTerms: true }))
V().submitApplication(vendor.email)
as(admin); V().decideApplication(vendor.email, 'approve', '', 60)
as(vendor)
const draft = { ...ls.emptyListingDraft(), name: 'Kano Dining Table', categoryId: 'tables', room: 'dining', description: 'Six-seater dining table in solid iroko with steel legs, finished by hand.', material: 'Iroko', dimensions: '180 × 90 × 75 cm', price: 100000, stock: 10, images: ['data:image/jpeg;base64,AAA'] }
const listing = V().saveListing(vendor.email, { draft, submitForReview: true }).data
as(admin); V().moderateListing(vendor.email, listing.id, 'approve', '')

const vid = cat.vendorIdFor(vendor.email)
const getProduct = id => id === listing.id ? { id, name: draft.name, price: 100000, inStock: true, assemblyAvailable: false, vendor: { id: vid, name: 'Ade Woodworks', trustScore: 60 } } : id === 'seed1' ? { id, name: 'Seed Sofa', price: 50000, inStock: true, assemblyAvailable: false, vendor: { id: 'v1', name: 'Seed Vendor', trustScore: 90 } } : undefined
const ownerEmail = id => id === listing.id ? vendor.email : undefined

async function paidDeliveredOrder(items) {
  as(buyer)
  const c = O().createPendingOrder({ customerEmail: buyer.email, customerName: buyer.name, address: addr, items, getProduct, ownerEmail })
  const o = c.data
  const s = await pay.mockProvider.initialize({ orderId: o.id, orderNumber: o.number, amountKobo: toKobo(o.total), currency: 'NGN', customerEmail: buyer.email, customerName: buyer.name, returnUrl: '/' })
  pay.mockGatewayRespond(s.reference, 'paid')
  const v = await pay.mockProvider.verify(s.reference)
  O().markPaid(o.id, { provider: 'mock', reference: s.reference, paidAmountKobo: v.paidAmountKobo })
  O().devMarkDelivered(o.id)
  return O().orders.find(x => x.id === o.id)
}

const order = await paidDeliveredOrder([{ productId: listing.id, qty: 2, assembly: false }])
const photo = ['data:image/jpeg;base64,BBB']
const create = (over = {}) => R().create({ orderId: order.id, items: [{ productId: listing.id, qty: 1 }], reason: 'damaged', details: 'Leg is cracked near the joint.', photos: photo, ...over })

console.log('\nStarting a return')
ok('order is delivered with a 7-day window', order.status === 'delivered' && lib.withinWindow(order))
as(stranger)
ok('someone else cannot return from my order', create().ok === false)
as(buyer)
ok('damage needs a photo', create({ photos: [] }).ok === false)
ok('"other" needs a real explanation (20+ chars)', create({ reason: 'other', details: 'bad', photos: [] }).ok === false)
ok('cannot return more than was bought', create({ items: [{ productId: listing.id, qty: 3 }] }).ok === false)
ok('nothing selected is refused', create({ items: [] }).ok === false)
ok('item not in the order is refused', create({ items: [{ productId: 'nope', qty: 1 }] }).ok === false)
ok('more than 3 photos refused', create({ photos: ['a', 'b', 'c', 'd'] }).ok === false)
ok('window closed after 7 days is refused', await (async () => {
  const old = { ...order, deliveredAt: new Date(Date.now() - 8 * 86_400_000).toISOString() }
  useOrdersStore.setState(s => ({ orders: s.orders.map(o => o.id === order.id ? old : o) }))
  const r = create().ok === false
  useOrdersStore.setState(s => ({ orders: s.orders.map(o => o.id === order.id ? order : o) }))
  return r
})())

const first = create()
ok('valid return created, waiting for the vendor', first.ok && first.data.status === 'requested' && /^RET-\d+$/.test(first.data.number))
ok('customer shown as first name + initial', first.data.customerLabel === 'Chidinma O.')
ok('quantity is now held (1 of 2 left)', lib.remainingQty(O().orders.find(o => o.id === order.id), R().returns)[listing.id] === 1)
ok('cannot return the same units twice', create({ items: [{ productId: listing.id, qty: 2 }] }).ok === false)

console.log('\nCancel + vendor response')
const spare = create()
ok('customer cancels a pending return', spare.ok && R().cancel(spare.data.id).ok && R().returns.find(r => r.id === spare.data.id).status === 'closed')
ok('cancelling releases the quantity', lib.remainingQty(O().orders.find(o => o.id === order.id), R().returns)[listing.id] === 1)
ok('stranger cannot cancel my return', (as(stranger), R().cancel(first.data.id).ok === false))
as(buyer)
ok('customer cannot answer as the vendor', R().vendorDecide(first.data.id, 'approve', '').ok === false)
as(other)
ok('a DIFFERENT vendor cannot answer', R().vendorDecide(first.data.id, 'approve', '').ok === false)
as(vendor)
ok('vendor must explain a rejection', R().vendorDecide(first.data.id, 'reject', 'no').ok === false)
ok('vendor rejects with reason', R().vendorDecide(first.data.id, 'reject', 'Photos show normal wear, not a defect.').ok && R().returns.find(r => r.id === first.data.id).status === 'rejected')
ok('vendor cannot change the answer afterwards', R().vendorDecide(first.data.id, 'approve', '').ok === false)

console.log('\nEscalation to Karta')
as(stranger)
ok('stranger cannot escalate', R().escalate(first.data.id, 'This is unfair to me').ok === false)
as(buyer)
ok('escalation needs a reason', R().escalate(first.data.id, 'no').ok === false)
ok('customer escalates a declined return', R().escalate(first.data.id, 'The crack is clearly visible in my photo.').ok && R().returns.find(r => r.id === first.data.id).status === 'escalated')
ok('customer cannot decide it themselves', R().adminDecide(first.data.id, 'uphold', 'I want my money back').ok === false)
as(vendor)
ok('vendor cannot overrule Karta', R().adminDecide(first.data.id, 'dismiss', 'Declining this again.').ok === false)
as(admin)
ok('admin needs a reason', R().adminDecide(first.data.id, 'uphold', '').ok === false)
ok('admin upholds the customer', R().adminDecide(first.data.id, 'uphold', 'Photo clearly shows a cracked joint.').ok && R().returns.find(r => r.id === first.data.id).status === 'approved')

console.log('\nReceiving + refunding')
as(buyer)
ok('customer cannot mark the item received', R().markReceived(first.data.id).ok === false)
ok('customer cannot issue a refund', (await R().issueRefund(first.data.id)).ok === false)
as(admin)
ok('cannot refund before the item is received', (await R().issueRefund(first.data.id)).ok === false)
ok('admin marks received', R().markReceived(first.data.id).ok)

const o1 = O().orders.find(o => o.id === order.id)
const calc = lib.computeRefund(o1, R().returns.find(r => r.id === first.data.id), R().returns)
ok('partial return: refund = item price only, NO delivery fee', calc.amount === 100000 && !calc.includesDelivery, JSON.stringify(calc))

const [a, b] = await Promise.all([R().issueRefund(first.data.id), R().issueRefund(first.data.id)])
ok('double-click pays exactly ONCE', [a, b].filter(x => x.ok).length === 1, JSON.stringify([a, b]))
const done = R().returns.find(r => r.id === first.data.id)
ok('return is refunded with the amount recorded', done.status === 'refunded' && done.refund.amount === 100000 && done.refund.status === 'completed')
ok('order tracks money returned', O().orders.find(o => o.id === order.id).refundedTotal === 100000)
ok('refunding again is refused', (await R().issueRefund(first.data.id)).ok === false)

const vo = V().byEmail[vendor.email].orders.find(o => o.id === 'vo_' + order.id)
ok('vendor earnings shrink: 200k sale, 100k returned → net 90k', vo.refundedItems === 100000 && vo.netEarning === 90000 && vo.commission === 10000, JSON.stringify([vo.refundedItems, vo.netEarning, vo.commission]))

console.log('\nSecond return completes the order → delivery fee returns too')
as(buyer)
const second = create({ items: [{ productId: listing.id, qty: 1 }] })
ok('remaining unit can be returned', second.ok)
as(vendor); R().vendorDecide(second.data.id, 'approve', 'Sorry about that.')
as(admin); R().markReceived(second.data.id)
const o2 = O().orders.find(o => o.id === order.id)
const calc2 = lib.computeRefund(o2, R().returns.find(r => r.id === second.data.id), R().returns)
ok('whole order returned for a FAULT: items + delivery fee', calc2.includesDelivery && calc2.amount === 100000 + o2.deliveryFee, JSON.stringify(calc2))
ok('second refund succeeds', (await R().issueRefund(second.data.id)).ok)
const final = O().orders.find(o => o.id === order.id)
ok('customer got back exactly what they paid (never more)', final.refundedTotal === final.total - 0 && final.refundedTotal <= final.total, `${final.refundedTotal} vs ${final.total}`)
ok('delivery fee flagged as refunded (can only happen once)', final.deliveryRefunded === true)
const vo2 = V().byEmail[vendor.email].orders.find(o => o.id === 'vo_' + order.id)
ok('vendor earns nothing from a fully returned order', vo2.netEarning === 0 && vo2.refundedItems === 200000)
ok('the order cap is enforced even if asked directly', O().recordRefund(order.id, 1, false).ok === false)

console.log('\nNot-fault return keeps the delivery fee')
as(admin)
const o3 = await paidDeliveredOrder([{ productId: listing.id, qty: 1, assembly: false }])
as(buyer)
const r3 = R().create({ orderId: o3.id, items: [{ productId: listing.id, qty: 1 }], reason: 'other', details: 'I no longer need this table, sorry.', photos: [] })
ok('"other" reason needs no photos', r3.ok)
const c3 = lib.computeRefund(o3, r3.data, R().returns)
ok('whole order but NOT the vendor’s fault → delivery fee is kept', !c3.includesDelivery && c3.amount === 100000, JSON.stringify(c3))

console.log('\nVendors without a portal')
const o4 = await paidDeliveredOrder([{ productId: 'seed1', qty: 1, assembly: false }])
as(buyer)
const r4 = R().create({ orderId: o4.id, items: [{ productId: 'seed1', qty: 1 }], reason: 'damaged', details: 'Arrived with a torn seam.', photos: photo })
ok('goes straight to Karta (no portal to answer it)', r4.ok && r4.data.status === 'escalated')

console.log('\nMixed vendors')
ok('items from different vendors must be separate requests', await (async () => {
  const mixed = await paidDeliveredOrder([{ productId: listing.id, qty: 1, assembly: false }, { productId: 'seed1', qty: 1, assembly: false }])
  as(buyer)
  return R().create({ orderId: mixed.id, items: [{ productId: listing.id, qty: 1 }, { productId: 'seed1', qty: 1 }], reason: 'damaged', details: 'Both items arrived damaged.', photos: photo }).ok === false
})())

console.log('\nProvider guard')
ok('mock provider refuses to refund more than was paid', (await pay.mockProvider.refund('MOCK-unknown', 0, 'x')).status === 'failed')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

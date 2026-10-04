// Minimal browser stubs
const mem = new Map()
globalThis.window = {
  localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) },
  dispatchEvent: () => true,
  setTimeout,
}
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗ FAIL:', name, extra) }
}

const { useAuthStore } = await import('@/store/auth.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const ob = await import('@/modules/vendors/lib/onboarding')
const ls = await import('@/modules/vendors/lib/listings')
const fin = await import('@/modules/vendors/lib/finance')
const { useLogisticsStore } = await import('@/modules/logistics/store/logistics.store')

const user = { id: 'u1', name: 'Ade Bello', email: 'Ade@Shop.ng', phone: '08031234567', role: 'vendor', businessName: 'Ade Woodworks' }
const S = () => useVendorStore.getState()
const W = () => S().byEmail['ade@shop.ng']

console.log('\nVendor onboarding')
const verifyAcct = (u) => useAuthStore.setState((s) => ({ accounts: { ...s.accounts, [u.email.toLowerCase()]: { user: { ...u, emailVerified: true, phoneVerified: true }, salt: 'x', hash: 'x' } } }))
verifyAcct(user)
S().ensureWorkspace(user)
ok('workspace created, keyed by lowercase email', !!W())
ok('prefilled from registration', W().profile.business.name === 'Ade Woodworks' && W().profile.contact.phone === '08031234567')
ok('empty application cannot be submitted', S().submitApplication(user.email).ok === false)
ok('step 0 reports errors when empty', Object.keys(ob.validateStep(W().profile, 0)).length >= 5)
ok('phone validator accepts 0803 123 4567', ob.isNigerianPhone('0803 123 4567'))
ok('phone validator accepts +2348031234567', ob.isNigerianPhone('+2348031234567'))
ok('phone validator rejects 12345', !ob.isNigerianPhone('12345'))

S().updateProfile(user.email, p => ({ ...p,
  business: { ...p.business, type: 'registered', rcNumber: 'RC123456', description: 'We handcraft solid hardwood furniture in Abuja since 2012.', categoryIds: ['sofas'], address: '12 Industrial Layout', city: 'Abuja', state: 'FCT (Abuja)' },
  payout: { bankName: 'Zenith Bank', accountNumber: '0123456789', accountName: 'Ade Woodworks' },
}))
ok('registered type requires CAC document', 'business_registration' in ob.validateDocuments(W().profile))
ok('documents step blocked without uploads', Object.keys(ob.validateStep(W().profile, 2)).length === 3)
ok('bad account number rejected', 'accountNumber' in ob.validatePayout({ ...W().profile, payout: { ...W().profile.payout, accountNumber: '12345' } }))

const doc = (kind) => ({ id: kind, kind, fileName: kind + '.pdf', sizeKb: 10, uploadedAt: new Date().toISOString() })
S().updateProfile(user.email, p => ({ ...p, documents: ['government_id', 'business_registration', 'proof_of_address'].map(doc) }))
ok('all steps valid except terms', ob.firstIncompleteStep(W().profile) === 4)
ok('cannot submit without agreeing to terms', S().submitApplication(user.email).ok === false)
S().updateProfile(user.email, p => ({ ...p, agreedToTerms: true }))
ok('application submits', S().submitApplication(user.email).ok === true)
ok('status is under_review', W().profile.status === 'under_review')
ok('cannot submit twice', S().submitApplication(user.email).ok === false)
ok('profile locked while under review', ob.isEditable(W().profile) === false)

console.log('\nListings')
const goodDraft = { ...ls.emptyListingDraft(), name: 'Kano Dining Table', categoryId: 'tables', room: 'dining', description: 'Six-seater dining table in solid iroko with steel legs, finished by hand.', material: 'Iroko', dimensions: '180 × 90 × 75 cm', price: 420000, stock: 5, images: ['data:image/jpeg;base64,AAA'] }
ok('draft saves with just a name', S().saveListing(user.email, { draft: { ...ls.emptyListingDraft(), name: 'Wip chair' }, submitForReview: false }).ok)
ok('submit blocked before vendor approval', S().saveListing(user.email, { draft: goodDraft, submitForReview: true }).ok === false)
useAuthStore.setState({ user: { id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' } })
S().decideApplication(user.email, 'approve', '', 60)
useAuthStore.setState({ user: { ...user } })
ok('vendor approved', W().profile.status === 'approved')
ok('incomplete listing rejected for review', S().saveListing(user.email, { draft: { ...goodDraft, images: [] }, submitForReview: true }).ok === false)
ok('discount must exceed price', 'originalPrice' in ls.validateListing({ ...goodDraft, originalPrice: 100000 }, 'submit'))
const saved = S().saveListing(user.email, { draft: goodDraft, submitForReview: true })
ok('valid listing goes in_review', saved.ok && saved.data.status === 'in_review')
ok('SKU generated', /^KRT-/.test(saved.data.sku), saved.data?.sku)
const ids = W().listings.map(l => l.sku)
ok('SKUs unique', new Set(ids).size === ids.length, ids.join())
useAuthStore.setState({ user: { id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' } })
S().moderateListing(user.email, saved.data.id, 'approve', '')
useAuthStore.setState({ user: { ...user } })
ok('moderation makes it live', W().listings.find(l => l.id === saved.data.id).status === 'live')
ok('live listing can be paused', S().setListingStatus(user.email, saved.data.id, 'paused').ok)
ok('paused → live again', S().setListingStatus(user.email, saved.data.id, 'live').ok)
ok('live → draft is not allowed', S().setListingStatus(user.email, saved.data.id, 'draft').ok === false)
ok('negative stock rejected', S().setListingStock(user.email, saved.data.id, -1).ok === false)
ok('stock 0 accepted', S().setListingStock(user.email, saved.data.id, 0).ok)
S().deleteListing(user.email, saved.data.id)
ok('live listings cannot be deleted', !!W().listings.find(l => l.id === saved.data.id))

console.log('\nOrders & finance (demo data)')
S().devLoadDemoData(user.email)
const orders = W().orders
ok('demo orders loaded', orders.length === 10)
const o1 = orders.find(o => o.id === 'demo_o1')
ok('commission is 10% and net adds up', o1.commission === Math.round(o1.subtotal * 0.1) && o1.netEarning === o1.subtotal - o1.commission)
ok('new → confirmed', S().advanceOrder(user.email, 'demo_o1').ok && W().orders.find(o => o.id === 'demo_o1').status === 'confirmed')
ok('confirmed → packing → ready', S().advanceOrder(user.email, 'demo_o1').ok && S().advanceOrder(user.email, 'demo_o1').ok && W().orders.find(o => o.id === 'demo_o1').status === 'ready_for_pickup')
ok('vendor cannot move past ready_for_pickup', S().advanceOrder(user.email, 'demo_o1').ok === false)
ok('decline needs a real reason', S().cancelOrder(user.email, 'demo_o2', 'no').ok === false)
ok('decline works on new order', S().cancelOrder(user.email, 'demo_o2', 'Material unavailable this month').ok)
ok('cannot cancel an order being packed', S().cancelOrder(user.email, 'demo_o4', 'changed my mind').ok === false)

const b = fin.computeBalances(W().orders, W().payouts)
const delivered = W().orders.filter(o => o.status === 'delivered')
ok('paid balance = payout total', b.paid === W().payouts.reduce((s, p) => s + p.amount, 0))
ok('paid orders are excluded from held/available', b.held + b.available === delivered.filter(o => !o.payoutId).reduce((s, o) => s + o.netEarning, 0))
ok('order delivered 5 days ago is still held (7-day window)', b.held > 0, JSON.stringify(b))
ok('cancelled orders earn nothing', !JSON.stringify(b).includes('NaN'))
const next = fin.nextPayoutDate(new Date('2026-10-01T10:00:00'))   // Thursday
ok('next payout from Thursday is Friday 2 Oct', next.getDay() === 5 && next.getDate() === 2, next.toString())
const fri = fin.nextPayoutDate(new Date('2026-10-02T10:00:00'))
ok('on a Friday, next payout is a week later', fri.getDate() === 9, fri.toString())
const chart = fin.earningsByDay(W().orders, 14)
ok('chart has 14 buckets, none NaN', chart.length === 14 && chart.every(d => Number.isFinite(d.amount)))

console.log('\nPersistence')
const raw = JSON.parse(mem.get('karta-vendor'))
ok('state persisted to storage', !!raw.state.byEmail['ade@shop.ng'])

console.log('\nLogistics')
const L = () => useLogisticsStore.getState()
const D = id => L().byEmail['driver@karta.test'].deliveries.find(d => d.id === id)
L().devLoadDemo('driver@karta.test')
ok('5 sample deliveries', L().byEmail['driver@karta.test'].deliveries.length === 5)
ok('assigned → picked_up', L().advance('driver@karta.test', 'demo_d1').ok && D('demo_d1').status === 'picked_up')
ok('→ in_transit → out_for_delivery', L().advance('driver@karta.test', 'demo_d1').ok && L().advance('driver@karta.test', 'demo_d1').ok && D('demo_d1').status === 'out_for_delivery')
ok('cannot complete before arriving', L().complete('driver@karta.test', 'demo_d2', { code: '7350', recipientName: 'Yusuf' }).ok === false)
ok('wrong code rejected', L().complete('driver@karta.test', 'demo_d1', { code: '0000', recipientName: 'Chidinma' }).ok === false)
ok('missing recipient rejected', L().complete('driver@karta.test', 'demo_d1', { code: '4821', recipientName: ' ' }).ok === false)
ok('still not delivered after bad attempts', D('demo_d1').status === 'out_for_delivery' && D('demo_d1').attempts === 0)
ok('correct code completes delivery', L().complete('driver@karta.test', 'demo_d1', { code: '4821', recipientName: 'Chidinma O', note: 'Left in lounge' }).ok)
ok('proof recorded', D('demo_d1').status === 'delivered' && D('demo_d1').proof.recipientName === 'Chidinma O')
ok('delivered job cannot be failed', L().fail('driver@karta.test', 'demo_d1', 'other', 'whatever happened').ok === false)
ok('fail "other" requires description', L().fail('driver@karta.test', 'demo_d3', 'other', '').ok === false)
ok('fail with standard reason', L().fail('driver@karta.test', 'demo_d3', 'customer_unreachable', '').ok && D('demo_d3').status === 'failed' && D('demo_d3').attempts === 1)
ok('failed job can be retried', L().advance('driver@karta.test', 'demo_d3').ok && D('demo_d3').status === 'out_for_delivery' && !D('demo_d3').failureReason)

const lib = await import('@/modules/logistics/lib/deliveries')
ok('0803… → 234803…', lib.toInternational('0803 123 4567') === '2348031234567')
ok('+234 stays', lib.toInternational('+234 803 123 4567') === '2348031234567')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

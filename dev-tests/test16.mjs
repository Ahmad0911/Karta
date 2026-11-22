// Run with KARTA_API=http://api.test/api and KARTA_DEV=0
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

// ---- a stand-in server ------------------------------------------------------
const log = []
const db = { listings: [], orders: [], app: { status: 'draft', business: { name: 'Ade Woodworks', type: 'individual', rcNumber: '', description: '', categoryIds: [], address: '', city: '', state: '' }, contact: { person: 'Ade', phone: '08031234567', whatsapp: '', email: 'ade@shop.ng' }, payout: { bankName: '', accountNumber: '', accountName: '' }, agreedToTerms: false, trustScore: 0, reviewNote: null, submittedAt: null, decidedAt: null, documents: [] } }
let failNext = null
const json = (s, b) => new Response(b === undefined ? null : JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } })
const err = (s, message, fields) => json(s, { error: { code: 'x', message, details: fields ? { fields } : {} } })
globalThis.fetch = async (url, init = {}) => {
  const path = String(url).replace('http://api.test/api', ''); const method = init.method ?? 'GET'; const body = init.body ? JSON.parse(init.body) : undefined
  log.push(`${method} ${path}`)
  if (failNext) { const f = failNext; failNext = null; return f }
  if (method === 'GET' && path === '/vendor/application') return json(200, { application: db.app })
  if (method === 'GET' && path === '/vendor/listings') return json(200, { listings: db.listings })
  if (method === 'GET' && path === '/vendor/orders') return json(200, { orders: db.orders })
  if (method === 'POST' && path === '/vendor/listings') { const l = { id: 'srv1', sku: 'KRT-SRV1', name: body.name, categoryId: '', room: '', description: '', material: '', dimensions: '', colors: [], priceKobo: 100, originalPriceKobo: null, stock: 0, deliveryMinDays: 3, deliveryMaxDays: 7, assemblyAvailable: false, images: [], status: 'draft', moderationNote: null, createdAt: 't', updatedAt: 't' }; db.listings.unshift(l); return json(201, l) }
  let m
  if ((m = path.match(/^\/vendor\/listings\/(\w+)$/)) && method === 'PUT') { const l = db.listings.find(x => x.id === m[1]); const { priceKobo, originalPriceKobo, ...rest } = body; Object.assign(l, rest, priceKobo !== undefined ? { priceKobo } : {}, originalPriceKobo !== undefined ? { originalPriceKobo } : {}); return json(200, l) }
  if ((m = path.match(/^\/vendor\/listings\/(\w+)\/submit$/))) { const l = db.listings.find(x => x.id === m[1]); l.status = 'in_review'; return json(200, l) }
  if ((m = path.match(/^\/vendor\/listings\/(\w+)\/pause$/))) { db.listings.find(x => x.id === m[1]).status = 'paused'; return json(200, {}) }
  if ((m = path.match(/^\/vendor\/orders\/(\w+)\/advance$/))) { const o = db.orders.find(x => x.id === m[1]); o.status = 'confirmed'; o.events.push({ status: 'confirmed', at: 't', note: null }); return json(200, o) }
  if ((m = path.match(/^\/vendor\/orders\/(\w+)\/decline$/))) { const o = db.orders.find(x => x.id === m[1]); o.status = 'cancelled'; o.cancelReason = body.reason; return json(200, o) }
  if (method === 'PUT' && path === '/vendor/application') { Object.assign(db.app.business, body.business); Object.assign(db.app.contact, body.contact); Object.assign(db.app.payout, body.payout); db.app.agreedToTerms = body.agreedToTerms; return json(200, { application: db.app }) }
  if (method === 'POST' && path === '/vendor/application/documents') { db.app.documents.push({ id: 'd' + db.app.documents.length, kind: body.kind, fileName: body.fileName, sizeKb: body.sizeKb, uploadedAt: 't' }); return json(201, {}) }
  if (method === 'POST' && path === '/vendor/application/submit') { db.app.status = 'under_review'; db.app.submittedAt = 'now'; return json(200, {}) }
  return json(404, { error: { code: 'not_found', message: 'nope' } })
}

const { useAuthStore } = await import('@/store/auth.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const V = () => useVendorStore.getState()
const me = { id: 'v1', name: 'Ade', email: 'ade@shop.ng', role: 'vendor', businessName: 'Ade Woodworks' }
useAuthStore.setState({ user: me, isAuthenticated: true })
const ws = () => V().byEmail['ade@shop.ng']
V().ensureWorkspace(me)

console.log('\nLoading the workspace from the server')
await V().syncWorkspace()
ok('the application status comes from the server', ws().profile.status === 'draft' && ws().profile.business.name === 'Ade Woodworks')

console.log('\nListings')
const draft = { name: ' Walnut sofa ', categoryId: 'sofas', room: 'living', description: 'A three-seater curved sofa with solid walnut legs and a washable linen cover.', material: 'Walnut', dimensions: '210 × 95 cm', colors: [], price: 450000, originalPrice: 500000, stock: 4, deliveryMinDays: 5, deliveryMaxDays: 10, assemblyAvailable: true, images: ['https://res.cloudinary.com/x/a.jpg'] }
log.length = 0
const saved = await V().saveListing('ade@shop.ng', { draft, submitForReview: true })
ok('create → fill in → submit, in that order', saved.ok && log.filter(l => l.includes('/vendor/listings')).slice(0, 3).join('|') === 'POST /vendor/listings|PUT /vendor/listings/srv1|POST /vendor/listings/srv1/submit')
ok('prices are sent in kobo', db.listings[0].priceKobo === 45_000_000 && db.listings[0].originalPriceKobo === 50_000_000)
ok('the name is trimmed', db.listings[0].name === 'Walnut sofa')
ok('the screen shows what the SERVER stored (naira, in review)', ws().listings[0].price === 450000 && ws().listings[0].status === 'in_review' && saved.data.status === 'in_review')
const incomplete = await V().saveListing('ade@shop.ng', { draft: { ...draft, description: 'short' }, submitForReview: true })
ok('an incomplete submission never reaches the server', !incomplete.ok && !log.slice(-3).includes('POST /vendor/listings'))
failNext = err(403, 'Your business must be verified before you can list products.')
const refused = await V().saveListing('ade@shop.ng', { id: 'srv1', draft, submitForReview: true })
ok('the server’s refusal is shown in plain words', !refused.ok && /verified/.test(refused.error))
db.listings[0].status = 'live'; await V().syncWorkspace()
ok('pause goes through the server', (await V().setListingStatus('ade@shop.ng', 'srv1', 'paused')).ok && ws().listings[0].status === 'paused')
ok('stock is validated before it is sent', (await V().setListingStock('ade@shop.ng', 'srv1', -2)).ok === false)
ok('a stock change is a server call', (await V().setListingStock('ade@shop.ng', 'srv1', 9)).ok && db.listings[0].stock === 9)

console.log('\nOrders')
db.orders.push({ id: 'o1', number: 'KRT-1', customerLabel: 'Chidinma O.', city: 'Abuja', state: 'FCT (Abuja)', lines: [{ listingId: 'srv1', name: 'Walnut sofa', unitPriceKobo: 45_000_000, qty: 1 }], subtotalKobo: 45_000_000, commissionKobo: 4_500_000, netEarningKobo: 40_500_000, status: 'new', placedAt: 't', deliveredAt: null, cancelReason: null, events: [{ status: 'new', at: 't', note: null }] })
await V().syncWorkspace()
const o = ws().orders[0]
ok('orders arrive in naira with the commission worked out by the server', o.subtotal === 450000 && o.commission === 45000 && o.netEarning === 405000 && o.customerLabel === 'Chidinma O.')
ok('advancing is decided by the server', (await V().advanceOrder('ade@shop.ng', 'o1')).ok && ws().orders[0].status === 'confirmed')
ok('declining sends the reason', (await V().cancelOrder('ade@shop.ng', 'o1', 'Wood supplier ran out of walnut.')).ok && db.orders[0].cancelReason === 'Wood supplier ran out of walnut.' && ws().orders[0].status === 'cancelled')

console.log('\nApplication')
V().updateProfile('ade@shop.ng', p => ({ ...p, business: { ...p.business, city: 'Abuja', state: 'FCT (Abuja)' }, documents: [{ id: 'local1', kind: 'government_id', fileName: 'id.jpg', sizeKb: 120, uploadedAt: 't' }] }))
log.length = 0
const sub = await V().submitApplication('ade@shop.ng')
ok('answers and documents are saved to the server before submitting', log.includes('PUT /vendor/application') && log.includes('POST /vendor/application/documents') && db.app.business.city === 'Abuja' && db.app.documents[0].kind === 'government_id')
ok('submit is a server decision, and the status that comes back is the server’s', sub.ok && ws().profile.status === 'under_review')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

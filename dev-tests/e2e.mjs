// END-TO-END: the site's own store code against a REAL running backend (cookies and all).
//   cd backend && ADMIN_EMAIL=admin@karta.test ADMIN_NAME="Karta Admin" ADMIN_PASSWORD='Cedar-Lantern-Quartz-81' npm run create-admin
//   cd backend && EXPOSE_DEV_CODES=true PORT=3999 npm start        (separate terminal)
//   KARTA_API=http://localhost:3999/api KARTA_DEV=0 node --no-warnings --experimental-loader ./dev-tests/loader.mjs dev-tests/e2e.mjs
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

// A browser's cookie jar, one per person.
const jars = {}; let who = 'anon'
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const jar = (jars[who] ??= new Map())
  const headers = { ...(init.headers ?? {}) }
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const res = await realFetch(url, { ...init, headers })
  for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || v === '') jar.delete(k); else jar.set(k, v) }
  return res
}

const { useAuthStore } = await import('@/store/auth.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const { useAdminVendors } = await import('@/modules/vendors/store/adminRemote')
const { useRemoteCatalogStore } = await import('@/modules/catalog/remote')
const { apiPost, API_BASE } = await import('@/lib/api')
const A = () => useAuthStore.getState(), V = () => useVendorStore.getState()
const tag = Date.now().toString(36)
const PW = 'Cedar-Lantern-Quartz-81'
const phone = () => '080' + String(Math.floor(10000000 + Math.random() * 89999999))

async function verifyBoth() {
  for (const channel of ['email', 'phone']) {
    const r = await (await fetch(`${API_BASE}/verification/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-karta-client': 'web' }, body: JSON.stringify({ channel }) })).json()
    const c = await apiPost('/verification/confirm', { channel, code: r.devCode })
    if (!r.devCode || c.verified === false) throw new Error('verification failed ' + JSON.stringify(r))
  }
  A().refreshSession(); await new Promise(r => setTimeout(r, 300))
}

console.log('\nVendor signs up through the site’s own auth code')
who = 'vendor'
const vEmail = `ade-${tag}@shop.ng`, vPhone = phone()
const reg = await A().register({ name: 'Ade Okafor', email: vEmail, phone: vPhone, password: PW, role: 'vendor', businessName: `Ade Woodworks ${tag}` })
ok('registers as a vendor on the real server', reg.ok, reg.error)
ok('the user in the browser is the server’s record', A().user?.role === 'vendor' && A().user.email === vEmail)
await verifyBoth()
ok('email and phone verified on the server', A().user.emailVerified && A().user.phoneVerified, JSON.stringify(A().user))

console.log('\nVendor applies')
V().ensureWorkspace(A().user); await V().syncWorkspace()
ok('workspace loads from the server as a draft', V().byEmail[vEmail].profile.status === 'draft')
V().updateProfile(vEmail, p => ({ ...p,
  business: { ...p.business, type: 'individual', description: 'We craft solid walnut and oak furniture by hand in our Abuja workshop.', categoryIds: ['sofas'], address: '12 Workshop Road, Wuse', city: 'Abuja', state: 'FCT (Abuja)' },
  contact: { ...p.contact, person: 'Ade Okafor', phone: vPhone, email: vEmail },
  payout: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ade Okafor' },
  documents: [{ id: 'l1', kind: 'government_id', fileName: 'id.jpg', sizeKb: 120, uploadedAt: new Date().toISOString() }, { id: 'l2', kind: 'proof_of_address', fileName: 'bill.pdf', sizeKb: 90, uploadedAt: new Date().toISOString() }],
  agreedToTerms: true }))
const sub = await V().submitApplication(vEmail)
ok('the application is accepted by the real validation rules', sub.ok, sub.error)
ok('status is now under review (server decided)', V().byEmail[vEmail].profile.status === 'under_review')

console.log('\nAdmin verifies the vendor')
who = 'admin'
const login = await A().login('admin@karta.test', PW)
ok('admin signs in', login.ok && A().user.role === 'admin', login.error)
await useAdminVendors.getState().load(true)
const rec = useAdminVendors.getState().records.find(r => r.email === vEmail)
ok('admin sees the application with full details', !!rec && rec.workspace.profile.contact.phone === vPhone && rec.workspace.profile.documents.length === 2)
const approve = await V().decideApplication(vEmail, 'approve', '', 72)
ok('admin approves with a trust score', approve.ok, approve.error)
ok('the list now shows the vendor as approved', useAdminVendors.getState().records.find(r => r.email === vEmail).workspace.profile.status === 'approved')
await useAdminVendors.getState().loadHistory(vEmail)
ok('the decision trail is recorded', useAdminVendors.getState().records.find(r => r.email === vEmail).workspace.profile.verificationLog.length >= 2)

console.log('\nVendor lists a product')
who = 'vendor'; A().login(vEmail, PW).then(() => {}); await new Promise(r => setTimeout(r, 400))
await A().login(vEmail, PW); await V().syncWorkspace()
ok('the vendor is now approved on their own screens', V().byEmail[vEmail].profile.status === 'approved' && V().byEmail[vEmail].profile.trustScore === 72)
const draft = { name: `Walnut sofa ${tag}`, categoryId: 'sofas', room: 'living', description: 'A three-seater curved sofa with solid walnut legs and a washable linen cover.', material: 'Walnut and linen', dimensions: '210 × 95 × 80 cm', colors: [{ name: 'Sand', hex: '#d8cbb5' }], price: 450000, originalPrice: 520000, stock: 4, deliveryMinDays: 5, deliveryMaxDays: 10, assemblyAvailable: true, images: ['https://res.cloudinary.com/demo/image/upload/sofa.jpg'] }
const saved = await V().saveListing(vEmail, { draft, submitForReview: true })
ok('the listing is created, filled in and submitted', saved.ok && saved.data.status === 'in_review', saved.error)
ok('the price comes back in naira', saved.data.price === 450000 && saved.data.originalPrice === 520000)
const pid = saved.data.id

console.log('\nAdmin moderates it')
who = 'admin'; await A().login('admin@karta.test', PW)
await useAdminVendors.getState().load(true)
const queued = useAdminVendors.getState().records.find(r => r.email === vEmail).workspace.listings.find(l => l.id === pid)
ok('it appears in the moderation queue', queued?.status === 'in_review')
const mod = await V().moderateListing(vEmail, pid, 'approve', '')
ok('admin approves it', mod.ok, mod.error)

console.log('\nShoppers see it')
who = 'shopper'
await useRemoteCatalogStore.getState().load(true)
const p = useRemoteCatalogStore.getState().byId[pid]
ok('it is in the public catalogue, in naira, with the vendor’s business name', p?.price === 450000 && p.vendor.name === `Ade Woodworks ${tag}` && p.vendor.trustScore === 72, JSON.stringify(p))
ok('the vendor’s email is not exposed anywhere in it', !JSON.stringify(p).includes(vEmail))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

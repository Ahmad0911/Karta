// Run with KARTA_DEV=1 (dev build behaviour)
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let offset = 0; const realNow = Date.now.bind(Date); Date.now = () => realNow() + offset
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const { mockVerification: M } = await import('@/modules/verification/providers')
const { getVerificationProvider, CODE_RULES } = await import('@/modules/verification')
const { useAuthStore } = await import('@/store/auth.store')
const { useOrdersStore } = await import('@/modules/orders/orders.store')
const { useVendorStore } = await import('@/modules/vendors/store/vendor.store')
const A = () => useAuthStore.getState()
const tick = (ms) => { offset += ms }

console.log('\nCodes')
ok('dev build uses the mock provider', getVerificationProvider()?.id === 'mock')
const r1 = await M.request('phone', '0803 555 1234')
ok('code is 6 digits', r1.ok && /^\d{6}$/.test(r1.devCode))
ok('code is not stored in plain text', !mem.get('karta-otp').includes(r1.devCode))
ok('immediate resend refused (60s cooldown)', (await M.request('phone', '08035551234')).ok === false)
ok('wrong code refused', (await M.confirm('phone', '08035551234', r1.devCode === '000000' ? '111111' : '000000')).ok === false)
ok('malformed code refused', (await M.confirm('phone', '08035551234', '12ab')).ok === false)
ok('0803… and +234803… are the SAME phone', (await M.confirm('phone', '+2348035551234', r1.devCode)).ok)
ok('code is single use', (await M.confirm('phone', '08035551234', r1.devCode)).ok === false)
ok('email targets are case-insensitive', await (async () => { const r = await M.request('email', 'Ade@Shop.NG'); return (await M.confirm('email', 'ade@shop.ng', r.devCode)).ok })())
ok('an email code does not verify a phone (channels are separate)', await (async () => { const r = await M.request('email', 'x@y.com'); return (await M.confirm('phone', 'x@y.com', r.devCode)).ok === false })())

console.log('\nBrute force + expiry')
tick(120_000)
const r2 = await M.request('phone', '08035559999')
let last
for (let i = 0; i < CODE_RULES.maxAttempts; i++) last = await M.confirm('phone', '08035559999', '999999' === r2.devCode ? '111111' : '999999')
ok(`code burned after ${CODE_RULES.maxAttempts} wrong guesses`, !last.ok && /Too many/.test(last.error), last.error)
ok('…even the CORRECT code no longer works', (await M.confirm('phone', '08035559999', r2.devCode)).ok === false)
tick(120_000)
const r3 = await M.request('phone', '08035559999')
tick(CODE_RULES.ttlMs + 1000)
ok('expired code refused', (await M.confirm('phone', '08035559999', r3.devCode)).ok === false)
// hourly cap
let capped
for (let i = 0; i < CODE_RULES.maxSendsPerHour + 1; i++) { tick(61_000); capped = await M.request('email', 'cap@test.com') }
ok(`max ${CODE_RULES.maxSendsPerHour} codes per hour per target`, capped.ok === false && /Too many/.test(capped.error), capped.error)
tick(3_700_000)
ok('allowed again after the hour', (await M.request('email', 'cap@test.com')).ok)

console.log('\nAccount flags')
await A().register({ name: 'Chidinma Okafor', email: 'chidinma@mail.com', phone: '08052345678', password: 'Tr1cky-Walnut-Table' })
ok('new accounts start UNVERIFIED', !A().user.emailVerified && !A().user.phoneVerified)
ok('cannot mark someone else’s phone as verified', A().markContactVerified('phone', '08099999999').ok === false)
ok('cannot mark someone else’s email as verified', A().markContactVerified('email', 'other@mail.com').ok === false)
ok('owner’s phone can be marked after a code', A().markContactVerified('phone', '+234 805 234 5678').ok && A().user.phoneVerified === true)
ok('flag persisted on the account record', A().accounts['chidinma@mail.com'].user.phoneVerified === true)
A().updateProfile({ name: 'Chidinma Okafor', phone: '0805 234 5678' })
ok('re-saving the SAME phone keeps it verified', A().user.phoneVerified === true)
A().updateProfile({ name: 'Chidinma Okafor', phone: '08061112222' })
ok('CHANGING the phone resets verification', A().user.phoneVerified === false)

console.log('\nEnforcement')
const addr = { fullName: 'Chidinma', phone: '08052345678', street: '14 Gana Street', city: 'Abuja', state: 'FCT (Abuja)' }
const getProduct = () => ({ id: 'p1', name: 'Chair', price: 1000, inStock: true, assemblyAvailable: false, vendor: { id: 'v1', name: 'V', trustScore: 90 } })
const tryOrder = () => useOrdersStore.getState().createPendingOrder({ customerEmail: 'chidinma@mail.com', customerName: 'C', address: addr, items: [{ productId: 'p1', qty: 1, assembly: false }], getProduct, ownerEmail: () => undefined })
ok('UNVERIFIED phone cannot place an order', tryOrder().ok === false && /verify your phone/i.test(tryOrder().error))
A().markContactVerified('phone', '08061112222')
ok('verified phone can place an order', tryOrder().ok)

const vend = { id: 'v', name: 'Ade Bello', email: 'ade2@shop.ng', phone: '08031234567', role: 'vendor', businessName: 'Ade W' }
useAuthStore.setState({ user: vend, accounts: { ...A().accounts, [vend.email]: { user: vend, salt: 'x', hash: 'x' } } })
const V = () => useVendorStore.getState()
V().ensureWorkspace(vend)
const doc = k => ({ id: k, kind: k, fileName: k + '.pdf', sizeKb: 5, uploadedAt: new Date().toISOString() })
V().updateProfile(vend.email, p => ({ ...p, business: { ...p.business, description: 'Handmade hardwood furniture crafted in our Abuja workshop since 2012.', categoryIds: ['tables'], address: '12 Industrial Layout', city: 'Abuja', state: 'FCT (Abuja)' }, payout: { bankName: 'Zenith Bank', accountNumber: '0123456789', accountName: 'Ade Bello' }, documents: ['government_id', 'proof_of_address'].map(doc), agreedToTerms: true }))
ok('vendor with UNVERIFIED contacts cannot submit', V().submitApplication(vend.email).ok === false)
const setFlags = (f) => useAuthStore.setState(s => ({ accounts: { ...s.accounts, [vend.email]: { ...s.accounts[vend.email], user: { ...s.accounts[vend.email].user, ...f } } } }))
setFlags({ emailVerified: true })
ok('email alone is not enough', V().submitApplication(vend.email).ok === false)
setFlags({ phoneVerified: true })
V().updateProfile(vend.email, p => ({ ...p, contact: { ...p.contact, phone: '08099998888' } }))
ok('contact phone must be the VERIFIED one', V().submitApplication(vend.email).ok === false)
V().updateProfile(vend.email, p => ({ ...p, contact: { ...p.contact, phone: '0803 123 4567' } }))
ok('verified vendor submits', V().submitApplication(vend.email).ok)

console.log('\nPassword reset')
useAuthStore.setState({ user: null, isAuthenticated: false })
ok('weak password refused', (await A().applyPasswordReset('chidinma@mail.com', 'short')).ok === false)
ok('unknown account refused', (await A().applyPasswordReset('ghost@nowhere.com', 'Brand-New-Pass7')).ok === false)
for (let i = 0; i < 5; i++) await A().login('chidinma@mail.com', 'wrong-pass-' + i)
ok('account is locked out after failures', (await A().login('chidinma@mail.com', 'Tr1cky-Walnut-Table')).ok === false)
ok('reset sets the new password', (await A().applyPasswordReset('chidinma@mail.com', 'Brand-New-Pass7')).ok)
ok('reset clears the lockout', (await A().login('chidinma@mail.com', 'Brand-New-Pass7')).ok)
ok('old password no longer works', (A().logout(), (await A().login('chidinma@mail.com', 'Tr1cky-Walnut-Table')).ok === false))
A().setAccountDisabled?.('x', true)
useAuthStore.setState(s => ({ accounts: { ...s.accounts, 'chidinma@mail.com': { ...s.accounts['chidinma@mail.com'], disabled: true } } }))
ok('deactivated accounts cannot be reset into', (await A().applyPasswordReset('chidinma@mail.com', 'Another-Good-Pass9')).ok === false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

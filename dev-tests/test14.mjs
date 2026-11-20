// Run with KARTA_API=http://api.test/api and KARTA_DEV=0 (a production-style build)
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const calls = []
let script = []
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = async (url, init) => { calls.push({ url, init }); const next = script.shift(); if (!next) throw new Error('unexpected call ' + url); return next }
const reset = () => { calls.length = 0; script = [] }

const { AUTH_API } = await import('@/store/auth.api')
const { useAuthStore, bootstrapSession } = await import('@/store/auth.store')
const A = () => useAuthStore.getState()
const apiUser = (over = {}) => ({ id: 'u1', email: 'ade@mail.com', name: 'Ade', phone: '08031234567', role: 'customer', businessName: null, mustChangePassword: false, emailVerified: false, phoneVerified: false, ...over })

console.log('\nProduction builds use the real server')
ok('API sign-in is on in a production build', AUTH_API === true)

console.log('\nLogin')
reset(); script = [reply(200, { user: apiUser() })]
const r = await A().login('  ADE@mail.com ', 'Tr1cky-Walnut-Table')
ok('logs in against /auth/login with a normalised email', r.ok && calls[0].url === 'http://api.test/api/auth/login' && JSON.parse(calls[0].init.body).email === 'ade@mail.com')
ok('the user comes from the SERVER’s answer', A().user.id === 'u1' && A().isAuthenticated)
ok('no password or hash is kept in the browser', JSON.stringify([...mem.values()]).includes('Tr1cky') === false && Object.keys(A().accounts).length === 0)
reset(); script = [reply(401, { error: { code: 'invalid_credentials', message: 'Incorrect email or password.' } })]
const bad = await A().login('ade@mail.com', 'wrong-password-123')
ok('a wrong password shows the server’s message and signs nobody in', !bad.ok && bad.error === 'Incorrect email or password.')

console.log('\nThe browser cannot pick its own role')
useAuthStore.setState({ user: null, isAuthenticated: false })
reset(); script = [reply(201, { user: apiUser({ role: 'customer' }) })]
await A().register({ name: 'Mallory', email: 'm@mail.com', phone: '08031234567', password: 'Tr1cky-Walnut-Table', role: 'admin' })
ok('asking for "admin" sends customer', JSON.parse(calls[0].init.body).role === 'customer')
ok('and the account is whatever the server created', A().user.role === 'customer')
useAuthStore.setState({ user: null })
reset(); script = [reply(201, { user: apiUser({ role: 'vendor', businessName: 'Ade Woodworks' }) })]
await A().register({ name: 'Ade', email: 'v@mail.com', phone: '08031234567', password: 'Tr1cky-Walnut-Table', role: 'vendor', businessName: 'Ade Woodworks' })
ok('vendors send their business name', JSON.parse(calls[0].init.body).businessName === 'Ade Woodworks' && A().user.role === 'vendor' && A().user.businessName === 'Ade Woodworks')
useAuthStore.setState({ user: null })
reset(); script = [reply(422, { error: { code: 'validation_failed', message: 'Please check the highlighted fields.', details: { fields: { password: 'Use at least 10 characters.' } } } })]
const weak = await A().register({ name: 'Ade', email: 'w@mail.com', phone: '08031234567', password: 'short', role: 'customer' })
ok('field errors from the server are shown', !weak.ok && weak.error === 'Use at least 10 characters.')

console.log('\nSession')
useAuthStore.setState({ user: toUserLike(apiUser()), isAuthenticated: true })
function toUserLike(u) { return { id: u.id, name: u.name, email: u.email, role: u.role } }
reset(); script = [reply(200, { user: apiUser({ role: 'vendor', phoneVerified: true }) })]
await bootstrapSession()
ok('on startup the server’s record replaces the saved one', A().user.role === 'vendor' && A().user.phoneVerified === true)
reset(); script = [reply(401, { error: { code: 'unauthorized', message: 'Please sign in.' } }), reply(401, { error: { code: 'session_invalid', message: 'Please sign in.' } })]
await bootstrapSession()
ok('an expired session signs the person out', A().user === null && A().isAuthenticated === false)
useAuthStore.setState({ user: toUserLike(apiUser()), isAuthenticated: true })
reset(); script = [reply(204)]
A().logout()
await new Promise(r => setTimeout(r, 0))
ok('logout clears the browser and tells the server', A().user === null && calls[0].url === 'http://api.test/api/auth/logout')

console.log('\nPassword + profile')
useAuthStore.setState({ user: toUserLike(apiUser()), isAuthenticated: true })
reset(); script = [reply(200, { user: apiUser() })]
const pw = await A().changePassword('Old-Password-123', 'New-Password-456')
ok('change password sends the right fields', pw.ok && JSON.parse(calls[0].init.body).currentPassword === 'Old-Password-123' && JSON.parse(calls[0].init.body).newPassword === 'New-Password-456')
reset(); script = [reply(422, { error: { code: 'validation_failed', message: 'x', details: { fields: { currentPassword: 'Your current password is incorrect.' } } } })]
const pw2 = await A().changePassword('nope-nope-nope', 'New-Password-456')
ok('a wrong current password is reported', !pw2.ok && /incorrect/.test(pw2.error))
reset(); script = [reply(200, { user: apiUser({ name: 'Ade Okafor', phone: '08099999999', phoneVerified: false }) })]
const up = A().updateProfile({ name: 'Ade Okafor', phone: '08099999999' })
ok('profile update is accepted immediately and flags the new phone unverified', up.ok && A().user.name === 'Ade Okafor' && A().user.phoneVerified === false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

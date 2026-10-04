const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const { useAuthStore } = await import('@/store/auth.store')
const { useProfileStore, MAX_ADDRESSES, DEFAULT_PREFS, selectProfile } = await import('@/modules/account/profile.store')
const A = () => useAuthStore.getState()
const P = () => useProfileStore.getState()
const me = 'chidinma@mail.com'
const addr = { fullName: 'Chidinma Okafor', phone: '08052345678', street: '14 Gana Street, Maitama', city: 'Abuja', state: 'FCT (Abuja)', label: 'Home' }

await A().register({ name: 'Chidinma Okafor', email: me, phone: '08052345678', password: 'Tr1cky-Walnut-Table' })

console.log('\nProfile editing')
ok('name too short rejected', A().updateProfile({ name: 'A', phone: '08052345678' }).ok === false)
ok('bad phone rejected', A().updateProfile({ name: 'Chidinma O', phone: '123' }).ok === false)
ok('name over 80 chars rejected', A().updateProfile({ name: 'x'.repeat(81), phone: '08052345678' }).ok === false)
ok('valid update saved', A().updateProfile({ name: '  Chidinma   Okafor-Eze ', phone: '0805 234 5678' }).ok)
ok('whitespace collapsed', A().user.name === 'Chidinma Okafor-Eze')
ok('email cannot be changed here', A().user.email === me)
ok('persisted to the account (survives sign-out/in)', (A().logout(), (await A().login(me, 'Tr1cky-Walnut-Table')).ok && A().user.name === 'Chidinma Okafor-Eze'))
useAuthStore.setState({ user: null, isAuthenticated: false })
ok('signed-out cannot edit', A().updateProfile({ name: 'Hacker', phone: '08052345678' }).ok === false)
await A().login(me, 'Tr1cky-Walnut-Table')

console.log('\nSaved addresses')
ok('empty profile has defaults, not undefined', selectProfile(me)(P()).notifications.promotions === false && selectProfile(me)(P()).addresses.length === 0)
ok('incomplete address rejected with field errors', (() => { const r = P().saveAddress(me, { ...addr, street: '', state: '' }); return !r.ok && 'street' in r.fields && 'state' in r.fields })())
ok('label required', (() => { const r = P().saveAddress(me, { ...addr, label: '' }); return !r.ok && 'label' in r.fields })())
const first = P().saveAddress(me, addr)
ok('first address saved and automatically default', first.ok && first.data.isDefault)
const second = P().saveAddress(me, { ...addr, label: 'Office', street: '3 Aminu Kano Crescent, Wuse 2' })
ok('second address is NOT default', second.ok && !second.data.isDefault)
ok('make default moves the flag (exactly one default)', (P().setDefaultAddress(me, second.data.id), selectProfile(me)(P()).addresses.filter(a => a.isDefault).length === 1 && selectProfile(me)(P()).addresses.find(a => a.isDefault).id === second.data.id))
ok('editing keeps the id', (() => { const r = P().saveAddress(me, { ...addr, id: first.data.id, label: 'Home (updated)' }); return r.ok && r.data.id === first.data.id && selectProfile(me)(P()).addresses.length === 2 })())
ok('saving with makeDefault takes over default', (P().saveAddress(me, { ...addr, id: first.data.id, label: 'Home', makeDefault: true }), selectProfile(me)(P()).addresses.find(a => a.isDefault).id === first.data.id && selectProfile(me)(P()).addresses.filter(a => a.isDefault).length === 1))
P().removeAddress(me, first.data.id)
ok('deleting the default promotes another', selectProfile(me)(P()).addresses.length === 1 && selectProfile(me)(P()).addresses[0].isDefault)
for (let i = 0; i < MAX_ADDRESSES; i++) P().saveAddress(me, { ...addr, label: 'A' + i })
ok(`capped at ${MAX_ADDRESSES} addresses`, selectProfile(me)(P()).addresses.length === MAX_ADDRESSES && P().saveAddress(me, { ...addr, label: 'Extra' }).ok === false)
ok('addresses are private per user', selectProfile('someone@else.com')(P()).addresses.length === 0)

console.log('\nNotifications')
ok('promotions OFF by default (opt-in)', DEFAULT_PREFS.promotions === false)
P().setNotifications(me, { orderUpdates: { email: false, sms: true, whatsapp: true }, promotions: true })
ok('preferences saved', selectProfile(me)(P()).notifications.promotions === true && selectProfile(me)(P()).notifications.orderUpdates.whatsapp === true)

console.log('\nAccount deletion')
ok('wrong password does not delete', (await A().deleteOwnAccount('wrong-password-1')).ok === false && !!A().accounts[me])
useAuthStore.setState({ user: { id: 'v', name: 'Vendor', email: 'v@x.com', role: 'vendor' } })
ok('vendors cannot self-delete', (await A().deleteOwnAccount('whatever')).ok === false)
useAuthStore.setState({ user: A().accounts[me].user })
ok('customer deletes with correct password', (await A().deleteOwnAccount('Tr1cky-Walnut-Table')).ok)
ok('account and session gone', !A().accounts[me] && A().user === null)
ok('cannot sign in afterwards', (await A().login(me, 'Tr1cky-Walnut-Table')).ok === false)
P().erase(me)
ok('profile data erased', selectProfile(me)(P()).addresses.length === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

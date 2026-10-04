const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }
const { useAuthStore } = await import('@/store/auth.store')
const { useSupportStore, visibleMessages, LIMITS } = await import('@/modules/support/support.store')
const as = u => useAuthStore.setState({ user: u, isAuthenticated: !!u })
const S = () => useSupportStore.getState()
const cust = { id: 'c', name: 'Chidinma Okafor', email: 'chidinma@mail.com', role: 'customer' }
const other = { id: 'o', name: 'Other', email: 'other@mail.com', role: 'customer' }
const admin = { id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' }
const good = { subject: 'My table has not arrived', category: 'delivery', message: 'It was due on Monday and I have heard nothing.' }

console.log('\nOpening a request')
as(null)
ok('signed-out cannot open one', S().create(good).ok === false)
as(cust)
ok('short subject refused', S().create({ ...good, subject: 'Hi' }).ok === false)
ok('short message refused', S().create({ ...good, message: 'help' }).ok === false)
ok('oversized message refused', S().create({ ...good, message: 'x'.repeat(2001) }).ok === false)
ok('someone else’s order refused', S().create({ ...good, orderId: 'ord_nope' }).ok === false)
const t = S().create(good)
ok('valid request opens, waiting for Karta', t.ok && t.data.status === 'open' && /^SUP-\d+$/.test(t.data.number))
ok('duplicate open subject refused', S().create(good).ok === false)
S().create({ ...good, subject: 'Second problem here' }); S().create({ ...good, subject: 'Third problem here' })
ok(`max ${LIMITS.maxOpen} open at once`, S().create({ ...good, subject: 'Fourth problem here' }).ok === false)

console.log('\nPrivacy')
as(other)
ok('another customer cannot reply to it', S().reply(t.data.id, 'I am snooping').ok === false)
ok('…or close it', S().close(t.data.id).ok === false)
as(cust)
ok('customer cannot use staff reply', S().staffReply(t.data.id, 'I am staff now').ok === false)
ok('customer cannot change status', S().staffSetStatus(t.data.id, 'resolved').ok === false)

console.log('\nConversation')
as(admin)
ok('staff replies → waiting for customer', S().staffReply(t.data.id, 'Sorry, checking with the driver now.').ok && S().tickets.find(x => x.id === t.data.id).status === 'pending')
ok('internal note does NOT change status', (S().staffReply(t.data.id, 'Driver says gate was locked', { internal: true }), S().tickets.find(x => x.id === t.data.id).status === 'pending'))
const tk = () => S().tickets.find(x => x.id === t.data.id)
ok('staff sees internal notes', visibleMessages(tk(), 'staff').some(m => m.internal))
ok('CUSTOMER does not see internal notes', !visibleMessages(tk(), 'requester').some(m => m.internal) && visibleMessages(tk(), 'requester').length === 2)
ok('staff marks resolved', S().staffSetStatus(t.data.id, 'resolved').ok)
as(cust)
ok('customer reply reopens a resolved request', S().reply(t.data.id, 'Still nothing, please help.').ok && tk().status === 'open')
ok('customer closes their own request', S().close(t.data.id).ok && tk().status === 'closed')
ok('cannot reply to a closed request', S().reply(t.data.id, 'Hello?').ok === false)
ok('closing frees a slot', S().create({ ...good, subject: 'A new fourth problem' }).ok)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

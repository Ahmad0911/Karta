// Run with KARTA_DEV=1. Vendors and customers never talk directly: Karta is the go-between.
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const { useAuthStore } = await import('@/store/auth.store')
const { useSupportStore } = await import('@/modules/support/support.store')
const { visibleMessages } = await import('@/modules/support/support.store')

const as = u => useAuthStore.setState({ user: u, isAuthenticated: !!u })
const S = () => useSupportStore.getState()
const cust = { id: 'c', name: 'Chidinma Okafor', email: 'chidinma@mail.com', role: 'customer', phoneVerified: true }
const vend = { id: 'v', name: 'Ade', email: 'ade@shop.ng', role: 'vendor' }
const admin = { id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' }

console.log('\nCustomer ↔ Karta')
as(cust)
const c = S().create({ subject: 'About my custom sofa', category: 'request', message: 'Can I change the colour?' })
ok('customer opens a chat with Karta', c.ok && c.data.requesterRole === 'customer')

console.log('\nVendor ↔ Karta')
as(vend)
const v = S().create({ subject: 'Payout question', category: 'payment', message: 'When is my payout due?' })
ok('vendor opens a chat with Karta', v.ok && v.data.requesterRole === 'vendor')
ok('vendor cannot attach a customer order or request to it', v.data.orderId === undefined && v.data.requestId === undefined)
ok('vendor cannot read or reply into the customer’s chat', S().reply(c.data.id, 'hello customer').ok === false)
ok('vendor cannot close the customer’s chat', S().close(c.data.id).ok === false)

console.log('\nCustomer cannot reach the vendor’s chat either')
as(cust)
ok('customer cannot reply into the vendor’s chat', S().reply(v.data.id, 'hello vendor').ok === false)

console.log('\nOnly Karta staff broker')
as(cust); ok('customers cannot start staff conversations', S().staffStart({ requesterEmail: vend.email, requesterName: 'Ade', requesterRole: 'vendor', subject: 'Direct to vendor', category: 'other', message: 'Hi vendor' }).ok === false)
as(vend); ok('vendors cannot start staff conversations', S().staffStart({ requesterEmail: cust.email, requesterName: 'C', requesterRole: 'customer', subject: 'Direct to customer', category: 'other', message: 'Hi customer' }).ok === false)
as(admin)
ok('admin cannot use the customer/vendor create path', S().create({ subject: 'Staff test here', category: 'other', message: 'hello there you' }).ok === false)
const s1 = S().staffStart({ requesterEmail: vend.email, requesterName: 'Ade Woodworks', requesterRole: 'vendor', subject: 'Custom piece REQ-1001', category: 'request', message: 'We have a custom sofa request that suits you.', requestId: 'req_1' })
ok('staff start a chat with a vendor', s1.ok && s1.data.requesterRole === 'vendor' && s1.data.status === 'pending')
ok('staff reply to the customer', S().staffReply(c.data.id, 'Yes, we can change it.').ok)
ok('internal notes are hidden from the person on the other end', visibleMessages({ ...S().tickets[0], messages: [{ id: 'x', from: 'staff', author: 'K', body: 'secret', at: '', internal: true }] }, 'requester').length === 0)

console.log('\nTickets are isolated')
as(vend)
const mine = S().tickets.filter(t => t.requesterEmail === vend.email)
ok('the vendor’s list holds only vendor chats', mine.length >= 2 && mine.every(t => t.requesterRole === 'vendor'))
ok('the customer’s chat is not in the vendor’s list', !mine.some(t => t.id === c.data.id))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

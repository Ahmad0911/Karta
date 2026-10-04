import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

console.log('\nRegression guard: unstable zustand selectors (caused "Maximum update depth exceeded")')
const walk = (d) => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [] })
const BAD = /use[A-Za-z]+Store\(\s*\(?\s*\w+\s*\)?\s*=>[^;\n]*?(\.filter\(|\.map\(|\.slice\(|\.sort\(|\.reduce\(|Object\.(values|entries|keys)\(|\{\s*\.\.\.|\[\s*\.\.\.)/
const offenders = walk(process.cwd() + '/src').filter(f => readFileSync(f, 'utf8').split('\n').some(l => BAD.test(l) && !l.includes('getState')))
ok('no selector builds a new array/object on every render', offenders.length === 0, offenders.join(', '))

const { useAuthStore } = await import('@/store/auth.store')
const { useApplicationsStore, validateApplication } = await import('@/modules/logistics/applications.store')
const A = () => useAuthStore.getState()
const L = () => useApplicationsStore.getState()
const asUser = u => useAuthStore.setState({ user: u, isAuthenticated: !!u })

const docs = [{ kind: 'government_id', fileName: 'id.pdf', sizeKb: 5 }, { kind: 'drivers_licence', fileName: 'dl.jpg', sizeKb: 5 }, { kind: 'vehicle_papers', fileName: 'vp.pdf', sizeKb: 5 }]
const good = { name: 'Musa Ibrahim', phone: '08035551234', state: 'FCT (Abuja)', city: 'Abuja', vehicle: 'van', plateNumber: 'ABC-123DE', licenceNumber: 'FKJ12345AA', experienceYears: '6', guarantorName: 'Hajiya Zainab', guarantorPhone: '08098761234', documents: docs, agreed: true }

console.log('\nValidation')
ok('good application has no errors', Object.keys(validateApplication(good)).length === 0)
ok('missing documents flagged individually', ['government_id', 'drivers_licence', 'vehicle_papers'].every(k => k in validateApplication({ ...good, documents: [] })))
ok('guarantor must be a different phone', 'guarantorPhone' in validateApplication({ ...good, guarantorPhone: '0803 555 1234' }))
ok('bad plate rejected', 'plateNumber' in validateApplication({ ...good, plateNumber: '!!' }))
ok('experience must be a number', 'experienceYears' in validateApplication({ ...good, experienceYears: 'abc' }) && 'experienceYears' in validateApplication({ ...good, experienceYears: '' }))
ok('terms required', 'agreed' in validateApplication({ ...good, agreed: false }))

console.log('\nApplying')
await A().register({ name: 'Musa Ibrahim', email: 'musa@mail.com', phone: '08035551234', password: 'Tr1cky-Walnut-Table' })
ok('applicant starts as a plain CUSTOMER', A().user.role === 'customer')
ok('cannot reach driver role by applying alone', A().user.role !== 'logistics')
ok('invalid application rejected with field errors', (() => { const r = L().submit('musa@mail.com', { ...good, documents: [] }); return !r.ok && !!r.fields })())
ok('cannot apply on behalf of someone else', L().submit('other@mail.com', good).ok === false)
ok('valid application submitted', L().submit('musa@mail.com', good).ok)
ok('status under_review', L().byEmail['musa@mail.com'].status === 'under_review')
ok('plate/licence upper-cased', L().byEmail['musa@mail.com'].plateNumber === 'ABC-123DE' && L().byEmail['musa@mail.com'].licenceNumber === 'FKJ12345AA')
ok('cannot submit twice while under review', L().submit('musa@mail.com', good).ok === false)
ok('still a customer while waiting (no portal access)', A().accounts['musa@mail.com'].user.role === 'customer')
asUser({ id: 'v', name: 'Vendor', email: 'v@x.com', role: 'vendor' })
ok('vendors cannot apply as drivers', L().submit('v@x.com', good).ok === false)

console.log('\nReview')
asUser(A().accounts['musa@mail.com'].user)
ok('applicant cannot approve themselves', L().decide('musa@mail.com', 'approve', '').ok === false)
ok('…and still not a driver', A().accounts['musa@mail.com'].user.role === 'customer')
ok('applicant cannot grant the role directly', A().grantLogisticsRole('musa@mail.com').ok === false)
asUser({ id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' })
ok('reject needs a real reason', L().decide('musa@mail.com', 'reject', 'no').ok === false)
ok('admin rejects with reason', L().decide('musa@mail.com', 'reject', 'Licence image is unreadable; please upload a clear copy.').ok)
ok('rejected ≠ driver', A().accounts['musa@mail.com'].user.role === 'customer')
ok('decision cannot be changed afterwards', L().decide('musa@mail.com', 'approve', '').ok === false)
asUser(A().accounts['musa@mail.com'].user)
ok('applicant can reapply after rejection', L().submit('musa@mail.com', good).ok && L().byEmail['musa@mail.com'].status === 'under_review')
ok('history keeps both submissions', L().byEmail['musa@mail.com'].log.filter(e => e.action === 'submitted').length === 2)
asUser({ id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' })
ok('admin CANNOT approve a driver whose phone is unverified', L().decide('musa@mail.com', 'approve', '').ok === false && A().accounts['musa@mail.com'].user.role === 'customer')
useAuthStore.setState((s) => ({ accounts: { ...s.accounts, 'musa@mail.com': { ...s.accounts['musa@mail.com'], user: { ...s.accounts['musa@mail.com'].user, phoneVerified: true } } } }))
ok('admin approves once the phone is verified', L().decide('musa@mail.com', 'approve', '').ok)
ok('account is now a DRIVER', A().accounts['musa@mail.com'].user.role === 'logistics')
ok('decision records who approved', L().byEmail['musa@mail.com'].decidedBy === 'admin@karta.test')

console.log('\nSession refresh after approval')
asUser({ ...A().accounts['musa@mail.com'].user, role: 'customer' })   // stale session from before approval
ok('stale session is still a customer', A().user.role === 'customer')
A().refreshSession()
ok('refreshSession picks up the new role', A().user.role === 'logistics')

console.log('\nGuards')
asUser({ id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' })
ok('grant works only for customers (not vendors/admins)', (A().accounts['musa@mail.com'].user.role = 'logistics', A().grantLogisticsRole('musa@mail.com').ok === false))
await A().register({ name: 'Eve', email: 'eve@x.com', phone: '08035550000', password: 'Tr1cky-Walnut-Table' })
asUser(A().accounts['eve@x.com'].user)
L().submit('eve@x.com', { ...good, phone: '08035550000', guarantorPhone: '08011112222' })
useAuthStore.setState((s) => ({ accounts: { ...s.accounts, 'eve@x.com': { ...s.accounts['eve@x.com'], user: { ...s.accounts['eve@x.com'].user, phoneVerified: true } } } }))
asUser({ id: 'a', name: 'Admin', email: 'admin@karta.test', role: 'admin' })
useApplicationsStore.setState(s => ({ byEmail: { ...s.byEmail, 'eve@x.com': { ...s.byEmail['eve@x.com'], documents: [] } } }))
ok('incomplete application cannot be approved even by an admin', L().decide('eve@x.com', 'approve', '').ok === false)
ok('…and the role was NOT granted', A().accounts['eve@x.com'].user.role === 'customer')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

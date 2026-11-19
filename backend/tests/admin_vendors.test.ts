import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { PASSWORD, signUp, start, uniqueEmail, verify, type Client, type Harness } from './harness.ts'

let h: Harness
let admin: Client
before(async () => { h = await start(); admin = await h.makeAdmin() })
after(async () => { await h.close() })

const BUSINESS = { name: 'Ade Woodworks', type: 'individual', description: 'Handmade hardwood furniture crafted in our Abuja workshop since 2012.', categoryIds: ['tables'], address: '12 Industrial Layout', city: 'Abuja', state: 'FCT (Abuja)' }
const doc = (kind: string) => ({ kind, fileName: `${kind}.pdf`, contentType: 'application/pdf', sizeKb: 120 })

/** A vendor who has filled in everything but not yet verified or submitted. */
async function vendor(over: Record<string, unknown> = {}, payout: Record<string, string> = {}) {
  const v = await signUp(h, { role: 'vendor', businessName: 'Ade Woodworks', ...over })
  await v.c.put('/api/vendor/application', {
    business: BUSINESS,
    contact: { person: v.u.name, phone: v.u.phone, email: v.u.email },
    payout: { bankName: 'Zenith Bank', accountNumber: '0123456789', accountName: v.u.name, ...payout },
    agreedToTerms: true,
  })
  await v.c.post('/api/vendor/application/documents', doc('government_id'))
  await v.c.post('/api/vendor/application/documents', doc('proof_of_address'))
  return v
}
const verifyBoth = async (v: Awaited<ReturnType<typeof vendor>>) => {
  await verify(h, v.c, 'email', v.u.email)
  h.advance(61_000)
  await verify(h, v.c, 'phone', v.u.phone)
}
const submitted = async (over: Record<string, unknown> = {}, payout: Record<string, string> = {}) => {
  const v = await vendor(over, payout)
  await verifyBoth(v)
  const r = await v.c.post('/api/vendor/application/submit')
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return { ...v, id: r.body.application.id as string }
}
const decide = (id: string, decision: string, extra: Record<string, unknown> = {}, who: Client = admin) =>
  who.post(`/api/admin/vendor-applications/${id}/decision`, { decision, ...extra })

describe('roles and permissions', () => {
  it('signed-out → 401 everywhere that needs an account', async () => {
    for (const p of ['/api/admin/drivers', '/api/admin/audit', '/api/admin/vendor-applications', '/api/vendor/application']) {
      assert.equal((await h.client().get(p)).status, 401, p)
    }
  })

  it('customers and vendors can’t reach admin routes', async () => {
    const cust = await signUp(h)
    const vend = await signUp(h, { role: 'vendor', businessName: 'Shop' })
    for (const c of [cust.c, vend.c]) {
      assert.equal((await c.get('/api/admin/drivers')).status, 403)
      assert.equal((await c.get('/api/admin/audit')).status, 403)
      assert.equal((await c.get('/api/admin/vendor-applications')).status, 403)
      assert.equal((await c.post('/api/admin/drivers', { name: 'X Y', email: uniqueEmail(), phone: '08031234567' })).status, 403)
    }
  })

  it('customers can’t use vendor routes; admins can’t either (vendor-only)', async () => {
    const cust = await signUp(h)
    assert.equal((await cust.c.get('/api/vendor/application')).status, 403)
    assert.equal((await admin.get('/api/vendor/application')).status, 403)
  })

  it('super_admin has staff access', async () => {
    const sa = await h.makeAdmin('super@karta.test', 'super_admin')
    assert.equal((await sa.get('/api/admin/drivers')).status, 200)
  })
})

describe('driver accounts (staff-created)', () => {
  const payload = () => ({ name: 'Musa Ibrahim', email: uniqueEmail('driver'), phone: '08035551234' })

  it('admin creates a driver and gets a one-time temporary password', async () => {
    const p = payload()
    const r = await admin.post('/api/admin/drivers', p)
    assert.equal(r.status, 201)
    assert.equal(r.body.driver.role, 'logistics')
    assert.equal(r.body.driver.mustChangePassword, true)
    assert.match(r.body.tempPassword, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)
    const row = h.deps.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(p.email) as { password_hash: string }
    assert.ok(!row.password_hash.includes(r.body.tempPassword), 'never stored in plain text')
    assert.equal((await admin.post('/api/admin/drivers', p)).status, 409)
    assert.equal((await admin.post('/api/admin/drivers', { ...p, email: uniqueEmail(), phone: '123' })).status, 422)
  })

  it('the driver must change the temporary password before anything else works', async () => {
    const p = payload()
    const temp = (await admin.post('/api/admin/drivers', p)).body.tempPassword
    const d = h.client()
    const login = await d.post('/api/auth/login', { email: p.email, password: temp })
    assert.equal(login.status, 200)
    assert.equal(login.body.user.mustChangePassword, true)

    assert.equal((await d.get('/api/auth/me')).status, 200, '/me is allowed')
    const blocked = await d.post('/api/verification/request', { channel: 'phone' })
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, 'password_change_required')

    assert.equal((await d.post('/api/auth/password/change', { currentPassword: temp, newPassword: 'Brand-New-Pass7' })).status, 200)
    assert.equal((await d.get('/api/auth/me')).body.user.mustChangePassword, false)
    assert.equal((await d.post('/api/verification/request', { channel: 'phone' })).status, 200)
    assert.equal((await h.client().post('/api/auth/login', { email: p.email, password: temp })).status, 401, 'temp password is dead')
  })

  it('deactivation signs the driver out immediately, and reactivation restores access', async () => {
    const p = payload()
    const created = await admin.post('/api/admin/drivers', p)
    const d = h.client()
    await d.post('/api/auth/login', { email: p.email, password: created.body.tempPassword })
    assert.equal((await d.get('/api/auth/me')).status, 200)

    assert.equal((await admin.post(`/api/admin/drivers/${created.body.driver.id}/deactivate`)).status, 200)
    assert.equal((await d.get('/api/auth/me')).status, 401, 'a valid token stops working at once')
    assert.equal((await d.post('/api/auth/refresh')).status, 401)

    const right = await h.client().post('/api/auth/login', { email: p.email, password: created.body.tempPassword })
    assert.equal(right.status, 403)
    assert.equal(right.body.error.code, 'account_disabled')
    const wrong = await h.client().post('/api/auth/login', { email: p.email, password: 'wrong-pass-123' })
    assert.equal(wrong.body.error.code, 'invalid_credentials', 'status isn’t revealed without the password')

    assert.equal((await admin.post(`/api/admin/drivers/${created.body.driver.id}/reactivate`)).status, 200)
    assert.equal((await h.client().post('/api/auth/login', { email: p.email, password: created.body.tempPassword })).status, 200)
  })

  it('only drivers can be toggled; unknown ids are 404; the list shows disabled state', async () => {
    const cust = await signUp(h)
    assert.equal((await admin.post(`/api/admin/drivers/${cust.user.id}/deactivate`)).status, 404)
    assert.equal((await admin.post('/api/admin/drivers/not-a-real-id/deactivate')).status, 404)
    const list = await admin.get('/api/admin/drivers')
    assert.ok(Array.isArray(list.body.drivers) && list.body.drivers.every((d: { role: string }) => d.role === 'logistics'))
  })
})

describe('vendor application', () => {
  it('starts as a draft prefilled from the account', async () => {
    const v = await signUp(h, { role: 'vendor', businessName: 'Ade Woodworks' })
    const r = await v.c.get('/api/vendor/application')
    assert.equal(r.status, 200)
    assert.equal(r.body.application.status, 'draft')
    assert.equal(r.body.application.business.name, 'Ade Woodworks')
    assert.equal(r.body.application.contact.email, v.u.email)
  })

  it('clients cannot set status, trust score or review notes', async () => {
    const v = await signUp(h, { role: 'vendor', businessName: 'Ade Woodworks' })
    const r = await v.c.put('/api/vendor/application', { status: 'approved', trustScore: 100, reviewNote: 'fine', business: { name: 'Ade Woodworks' } })
    assert.equal(r.status, 200)
    assert.equal(r.body.application.status, 'draft')
    assert.equal(r.body.application.trustScore, 0)
    assert.equal(r.body.application.reviewNote, null)
  })

  it('partial updates merge instead of overwriting', async () => {
    const v = await vendor()
    const r = await v.c.put('/api/vendor/application', { business: { city: 'Lagos' } })
    assert.equal(r.body.application.business.city, 'Lagos')
    assert.equal(r.body.application.business.name, 'Ade Woodworks')
    assert.equal(r.body.application.payout.bankName, 'Zenith Bank')
  })

  it('submitting an empty application lists exactly what is missing', async () => {
    const v = await signUp(h, { role: 'vendor', businessName: 'Ade Woodworks' })
    const r = await v.c.post('/api/vendor/application/submit')
    assert.equal(r.status, 422)
    const f = r.body.error.details.fields
    for (const k of ['business.description', 'business.categoryIds', 'business.address', 'payout.accountNumber', 'documents.government_id', 'documents.proof_of_address', 'agreedToTerms']) assert.ok(f[k], k)
  })

  it('registered businesses must also upload a CAC certificate', async () => {
    const v = await vendor()
    await v.c.put('/api/vendor/application', { business: { type: 'registered', rcNumber: 'RC1234567' } })
    assert.ok((await v.c.post('/api/vendor/application/submit')).body.error.details.fields['documents.business_registration'])
  })

  it('documents: only pdf/jpg/png under 5 MB, one per kind, removable', async () => {
    const v = await vendor()
    assert.equal((await v.c.post('/api/vendor/application/documents', { ...doc('government_id'), contentType: 'application/x-msdownload' })).status, 422)
    assert.equal((await v.c.post('/api/vendor/application/documents', { ...doc('government_id'), sizeKb: 6000 })).status, 422)
    assert.equal((await v.c.post('/api/vendor/application/documents', { ...doc('passport') })).status, 422)
    await v.c.post('/api/vendor/application/documents', { ...doc('government_id'), fileName: 'new-id.pdf' })
    const app = (await v.c.get('/api/vendor/application')).body.application
    assert.equal(app.documents.filter((d: { kind: string }) => d.kind === 'government_id').length, 1)
    assert.equal(app.documents.find((d: { kind: string }) => d.kind === 'government_id').fileName, 'new-id.pdf')
    const id = app.documents[0].id
    assert.equal((await v.c.del(`/api/vendor/application/documents/${id}`)).status, 204)
  })

  it('cannot submit until BOTH email and phone are verified', async () => {
    const v = await vendor()
    const none = await v.c.post('/api/vendor/application/submit')
    assert.equal(none.status, 400)
    assert.equal(none.body.error.code, 'verification_required')
    await verify(h, v.c, 'email', v.u.email)
    assert.equal((await v.c.post('/api/vendor/application/submit')).body.error.code, 'verification_required', 'email alone isn’t enough')
  })

  it('the contact details must be the ones that were verified', async () => {
    const v = await vendor()
    await verifyBoth(v)
    await v.c.put('/api/vendor/application', { contact: { phone: '08099998888' } })
    const r = await v.c.post('/api/vendor/application/submit')
    assert.equal(r.status, 400)
    assert.equal(r.body.error.code, 'contact_mismatch')
  })

  it('a complete, verified application is submitted and then locked', async () => {
    const v = await submitted()
    const app = (await v.c.get('/api/vendor/application')).body.application
    assert.equal(app.status, 'under_review')
    assert.ok(app.submittedAt)
    assert.equal((await v.c.put('/api/vendor/application', { business: { name: 'Changed' } })).status, 409)
    assert.equal((await v.c.post('/api/vendor/application/submit')).status, 409)
    assert.equal((await v.c.post('/api/vendor/application/documents', doc('workshop_photo'))).status, 409)
  })
})

describe('admin verification', () => {
  it('lists submitted applications, hides drafts, and shows explainable signals', async () => {
    const s = await submitted()
    const draft = await signUp(h, { role: 'vendor', businessName: 'Draft Co' })
    await draft.c.get('/api/vendor/application')

    const list = await admin.get('/api/admin/vendor-applications?status=under_review')
    assert.ok(list.body.applications.some((a: { id: string }) => a.id === s.id))
    assert.ok(!list.body.applications.some((a: { email: string }) => a.email === draft.u.email), 'drafts are invisible to staff')

    const detail = await admin.get(`/api/admin/vendor-applications/${s.id}`)
    assert.equal(detail.status, 200)
    assert.equal(detail.body.owner.emailVerified, true)
    assert.equal(detail.body.owner.phoneVerified, true)
    assert.ok(Array.isArray(detail.body.signals))
    assert.equal(detail.body.history[0].action, 'submitted')
  })

  it('full lifecycle: request changes → vendor fixes → approve → locked; every step needs the right state', async () => {
    const s = await submitted()

    assert.equal((await decide(s.id, 'request_changes')).status, 422, 'a note is required')
    assert.equal((await decide(s.id, 'request_changes', { note: 'short' })).status, 422)
    const rc = await decide(s.id, 'request_changes', { note: 'Please upload a clearer proof of address.' })
    assert.equal(rc.status, 200)
    assert.equal(rc.body.application.status, 'changes_requested')

    const mine = (await s.c.get('/api/vendor/application')).body.application
    assert.equal(mine.reviewNote, 'Please upload a clearer proof of address.', 'the vendor sees the note')

    assert.equal((await decide(s.id, 'approve')).status, 409, 'can’t approve while the vendor is fixing things')
    assert.equal((await s.c.post('/api/vendor/application/documents', doc('proof_of_address'))).status, 201)
    assert.equal((await s.c.post('/api/vendor/application/submit')).status, 200)

    const ok = await decide(s.id, 'approve', { trustScore: 75 })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.application.status, 'approved')
    assert.equal(ok.body.application.trustScore, 75)
    assert.equal((await decide(s.id, 'approve')).status, 409, 'can’t approve twice')
    assert.equal((await s.c.put('/api/vendor/application', { business: { name: 'Sneaky' } })).status, 409, 'approved applications are locked')
  })

  it('approve defaults the trust score to 60 and validates the range', async () => {
    const s = await submitted()
    assert.equal((await decide(s.id, 'approve', { trustScore: 150 })).status, 422)
    assert.equal((await decide(s.id, 'approve')).body.application.trustScore, 60)
  })

  it('reject → terminal; suspend only from approved; reinstate only from suspended', async () => {
    const a = await submitted()
    assert.equal((await decide(a.id, 'suspend', { note: 'Not approved yet so can’t suspend.' })).status, 409)
    assert.equal((await decide(a.id, 'reinstate')).status, 409)
    assert.equal((await decide(a.id, 'reject')).status, 422, 'rejection needs a reason')
    assert.equal((await decide(a.id, 'reject', { note: 'ID does not match the business owner.' })).body.application.status, 'rejected')
    assert.equal((await decide(a.id, 'approve')).status, 409, 'rejected stays rejected')

    const b = await submitted()
    await decide(b.id, 'approve')
    assert.equal((await decide(b.id, 'suspend', { note: 'Customer complaints under investigation.' })).body.application.status, 'suspended')
    assert.equal((await decide(b.id, 'reinstate')).body.application.status, 'approved')
  })

  it('only staff can decide; the vendor can’t approve themselves', async () => {
    const s = await submitted()
    assert.equal((await decide(s.id, 'approve', {}, s.c)).status, 403)
    const cust = await signUp(h)
    assert.equal((await decide(s.id, 'approve', {}, cust.c)).status, 403)
    assert.equal((await h.client().post(`/api/admin/vendor-applications/${s.id}/decision`, { decision: 'approve' })).status, 401)
    assert.equal((await s.c.get('/api/vendor/application')).body.application.status, 'under_review')
  })

  it('refuses to approve if verification was lost after submitting', async () => {
    const s = await submitted()
    h.deps.db.prepare('UPDATE users SET phone_verified_at = NULL WHERE email = ?').run(s.u.email)
    const r = await decide(s.id, 'approve')
    assert.equal(r.status, 400)
    assert.equal(r.body.error.code, 'verification_required')
  })

  it('rejects unknown decisions and unknown applications', async () => {
    const s = await submitted()
    assert.equal((await decide(s.id, 'make_me_rich')).status, 422)
    assert.equal((await decide('00000000-0000-0000-0000-000000000000', 'approve')).status, 404)
  })

  it('flags shared phone numbers, shared bank accounts and name mismatches for the reviewer', async () => {
    const phone = '08037771234'
    const first = await submitted({ phone })
    const second = await submitted({ phone }, { accountNumber: '0123456789', accountName: 'Random Person' })
    const sig = (await admin.get(`/api/admin/vendor-applications/${second.id}`)).body.signals as { level: string; text: string }[]
    const texts = sig.map((s) => s.text).join('\n')
    assert.match(texts, /Same phone number/)
    assert.match(texts, /Same bank account/)
    assert.match(texts, /doesn’t resemble the business name or contact person/)
    assert.ok(sig.some((s) => s.level === 'warning'))
    assert.match((await admin.get(`/api/admin/vendor-applications/${first.id}`)).body.signals.map((s: { text: string }) => s.text).join('\n'), /Same phone number/, 'symmetrical')

    await decide(first.id, 'reject', { note: 'Documents appear to be edited.' })
    const again = (await admin.get(`/api/admin/vendor-applications/${second.id}`)).body.signals.map((s: { text: string }) => s.text).join('\n')
    assert.match(again, /previously REJECTED/)
  })
})

describe('audit trail', () => {
  it('records who did what, and never anything secret', async () => {
    const s = await submitted()
    await decide(s.id, 'approve', { trustScore: 70 })
    const events = (await admin.get(`/api/admin/audit?entityType=vendor_application&entityId=${s.id}`)).body.events as { action: string; actor_role: string; meta: { to?: string } | null }[]
    const actions = events.map((e) => e.action)
    assert.ok(actions.includes('vendor.application_submitted'))
    assert.ok(actions.includes('vendor.approved'))
    assert.equal(events.find((e) => e.action === 'vendor.approved')!.actor_role, 'admin')
    assert.equal(events.find((e) => e.action === 'vendor.approved')!.meta?.to, 'approved')

    const all = JSON.stringify((await admin.get('/api/admin/audit?limit=200')).body)
    assert.ok(!all.includes(PASSWORD), 'passwords never reach the log')
    assert.ok(!/"code":"\d{6}"/.test(all))
  })

  it('is append-only: the DATABASE refuses edits and deletes', async () => {
    const { db } = h.deps
    assert.ok((db.prepare('SELECT COUNT(*) AS n FROM audit_log').get() as { n: number }).n > 0)
    assert.throws(() => db.prepare("UPDATE audit_log SET action = 'forged'").run(), /append-only/)
    assert.throws(() => db.prepare('DELETE FROM audit_log').run(), /append-only/)
  })

  it('logins, driver changes and account events are all recorded', async () => {
    const p = { name: 'Audit Driver', email: uniqueEmail('driver'), phone: '08035551234' }
    await admin.post('/api/admin/drivers', p)
    const actions = ((await admin.get('/api/admin/audit?limit=200')).body.events as { action: string }[]).map((e) => e.action)
    for (const a of ['user.registered', 'auth.login', 'driver.created', 'user.email_verified', 'user.phone_verified']) assert.ok(actions.includes(a), a)
  })
})

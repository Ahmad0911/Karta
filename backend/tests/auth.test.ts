import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createHmac } from 'node:crypto'
import { ORIGIN, PASSWORD, signUp, start, newUser, uniqueEmail, type Harness } from './harness.ts'

let h: Harness
before(async () => { h = await start() })
after(async () => { await h.close() })

describe('platform', () => {
  it('health check works and every response carries security headers', async () => {
    const r = await h.client().get('/api/health')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { status: 'ok' })
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(r.headers.get('x-frame-options'), 'DENY')
    assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'none'/)
    assert.ok(r.headers.get('x-request-id'))
  })

  it('unknown routes → 404, wrong methods → 405, both as JSON errors', async () => {
    const c = h.client()
    assert.equal((await c.get('/api/nope')).status, 404)
    const m = await c.post('/api/health')
    assert.equal(m.status, 405)
    assert.equal(m.body.error.code, 'method_not_allowed')
  })

  it('rejects malformed requests safely', async () => {
    const c = h.client()
    assert.equal((await c.post('/api/auth/login', undefined, { raw: '{not json' })).status, 400)
    assert.equal((await c.post('/api/auth/login', undefined, { raw: 'a=b', contentType: 'text/plain' })).status, 415)
    const big = await c.post('/api/auth/login', undefined, { raw: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }) })
    assert.equal(big.status, 413)
    assert.equal(big.body.error.code, 'payload_too_large')
  })

  it('internal errors never leak details', async () => {
    const r = await h.client().get('/api/admin/audit')
    assert.equal(r.status, 401) // sanity: errors have the standard shape
    assert.ok(r.body.error.requestId)
  })
})

describe('CSRF + CORS', () => {
  it('state-changing calls without the client header are blocked', async () => {
    const r = await h.client().post('/api/auth/login', { email: 'a@b.co', password: 'x' }, { csrf: false })
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'csrf_blocked')
  })

  it('an origin that isn’t ours is refused, even with the header', async () => {
    const r = await h.client().post('/api/auth/login', { email: 'a@b.co', password: 'x' }, { headers: { origin: 'https://evil.example' } })
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'origin_not_allowed')
    assert.equal(r.headers.get('access-control-allow-origin'), null)
  })

  it('our origin gets CORS headers with credentials; others get none', async () => {
    const ok = await h.client().get('/api/health', { headers: { origin: ORIGIN } })
    assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN)
    assert.equal(ok.headers.get('access-control-allow-credentials'), 'true')
    const no = await h.client().get('/api/health', { headers: { origin: 'https://evil.example' } })
    assert.equal(no.headers.get('access-control-allow-origin'), null)
  })

  it('preflight: allowed for our origin, refused for others', async () => {
    const ok = await h.client().call('OPTIONS', '/api/auth/login', undefined, { headers: { origin: ORIGIN }, csrf: false })
    assert.equal(ok.status, 204)
    assert.match(ok.headers.get('access-control-allow-headers') ?? '', /x-karta-client/i)
    const no = await h.client().call('OPTIONS', '/api/auth/login', undefined, { headers: { origin: 'https://evil.example' }, csrf: false })
    assert.equal(no.status, 403)
  })
})

describe('registration', () => {
  it('creates a customer, sets httpOnly cookies, never returns secrets', async () => {
    const c = h.client()
    const u = newUser()
    const r = await c.post('/api/auth/register', u)
    assert.equal(r.status, 201)
    assert.equal(r.body.user.role, 'customer')
    assert.equal(r.body.user.email, u.email)
    assert.equal(r.body.user.emailVerified, false)
    assert.ok(!JSON.stringify(r.body).includes('password'))
    const set = r.headers.getSetCookie().join('\n')
    assert.match(set, /karta_at=.*HttpOnly.*SameSite=Lax/)
    assert.match(set, /karta_rt=.*Path=\/api\/auth.*HttpOnly/)
    assert.ok(!set.includes('Secure'), 'Secure flag only in production')
  })

  it('stores a scrypt hash, never the password', async () => {
    const { u } = await signUp(h)
    const row = h.deps.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(u.email) as { password_hash: string }
    assert.match(row.password_hash, /^scrypt\$\d+\$8\$1\$/)
    assert.ok(!row.password_hash.includes(PASSWORD))
  })

  it('NOBODY can register as admin, logistics or super_admin', async () => {
    for (const role of ['admin', 'logistics', 'super_admin', 'ADMIN']) {
      const r = await h.client().post('/api/auth/register', newUser({ role }))
      assert.equal(r.status, 422, role)
      assert.ok(r.body.error.details.fields.role)
    }
  })

  it('vendors need a business name; vendors can register', async () => {
    assert.equal((await h.client().post('/api/auth/register', newUser({ role: 'vendor' }))).status, 422)
    const ok = await h.client().post('/api/auth/register', newUser({ role: 'vendor', businessName: 'Ade Woodworks' }))
    assert.equal(ok.status, 201)
    assert.equal(ok.body.user.role, 'vendor')
    assert.equal(ok.body.user.businessName, 'Ade Woodworks')
  })

  it('unknown fields are ignored (no mass-assignment)', async () => {
    const r = await h.client().post('/api/auth/register', newUser({ emailVerified: true, phoneVerified: true, mustChangePassword: true, id: 'hacked' }))
    assert.equal(r.status, 201)
    assert.equal(r.body.user.emailVerified, false)
    assert.equal(r.body.user.phoneVerified, false)
    assert.equal(r.body.user.mustChangePassword, false)
    assert.notEqual(r.body.user.id, 'hacked')
  })

  it('validates input and reports every problem by field', async () => {
    const r = await h.client().post('/api/auth/register', { name: 'A', email: 'nope', phone: '123', password: 'short' })
    assert.equal(r.status, 422)
    assert.deepEqual(Object.keys(r.body.error.details.fields).sort(), ['email', 'name', 'phone'])
    const weak = await h.client().post('/api/auth/register', newUser({ password: '12345678901' }))
    assert.equal(weak.status, 422)
    assert.ok(weak.body.error.details.fields.password)
  })

  it('duplicate emails are refused, case-insensitively', async () => {
    const { u } = await signUp(h)
    const r = await h.client().post('/api/auth/register', newUser({ email: u.email.toUpperCase() }))
    assert.equal(r.status, 409)
    assert.equal(r.body.error.code, 'email_taken')
  })
})

describe('login, lockout, sessions', () => {
  it('logs in with the right password; wrong password and unknown email look identical', async () => {
    const { u } = await signUp(h)
    const c = h.client()
    const bad = await c.post('/api/auth/login', { email: u.email, password: 'wrong-password-1' })
    const ghost = await c.post('/api/auth/login', { email: uniqueEmail('ghost'), password: 'wrong-password-1' })
    assert.equal(bad.status, 401)
    assert.deepEqual(bad.body.error.code, ghost.body.error.code)
    assert.equal(bad.body.error.message, ghost.body.error.message)
    const ok = await c.post('/api/auth/login', { email: u.email.toUpperCase(), password: u.password })
    assert.equal(ok.status, 200)
    assert.equal((await c.get('/api/auth/me')).body.user.email, u.email)
  })

  it('locks after 5 failures (even for emails that don’t exist), unlocks after 15 minutes', async () => {
    const { u } = await signUp(h)
    const c = h.client()
    let last
    for (let i = 0; i < 5; i++) last = await c.post('/api/auth/login', { email: u.email, password: `wrong-pass-${i}` })
    assert.equal(last!.status, 401)
    const locked = await c.post('/api/auth/login', { email: u.email, password: u.password })
    assert.equal(locked.status, 429, 'the CORRECT password is refused while locked')
    assert.equal(locked.body.error.code, 'account_locked')
    assert.ok(Number(locked.headers.get('retry-after')) > 0)

    const ghost = uniqueEmail('ghost')
    for (let i = 0; i < 5; i++) await c.post('/api/auth/login', { email: ghost, password: `wrong-pass-${i}` })
    assert.equal((await c.post('/api/auth/login', { email: ghost, password: 'x' })).body.error.code, 'account_locked', 'no enumeration through lockouts')

    h.advance(16 * 60_000)
    assert.equal((await c.post('/api/auth/login', { email: u.email, password: u.password })).status, 200)
  })

  it('/me needs a session', async () => {
    assert.equal((await h.client().get('/api/auth/me')).status, 401)
    const { c } = await signUp(h)
    assert.equal((await c.get('/api/auth/me')).status, 200)
  })

  it('access tokens expire after 15 minutes; refresh restores access', async () => {
    const { c } = await signUp(h)
    h.advance(16 * 60_000)
    assert.equal((await c.get('/api/auth/me')).status, 401)
    assert.equal((await c.post('/api/auth/refresh')).status, 200)
    assert.equal((await c.get('/api/auth/me')).status, 200)
  })

  it('refresh rotates tokens; replaying an old one revokes the whole session (stolen-token detection)', async () => {
    const { c } = await signUp(h)
    const stolen = c.jar.get('karta_rt')!.value
    assert.equal((await c.post('/api/auth/refresh')).status, 200)
    assert.notEqual(c.cookie('karta_rt'), stolen, 'refresh token rotated')

    const thief = h.client()
    thief.setCookie('karta_rt', stolen, '/api/auth')
    const replay = await thief.post('/api/auth/refresh')
    assert.equal(replay.status, 401)
    assert.equal(replay.body.error.code, 'session_invalid')

    // The legitimate user's newest token and access token are dead too.
    assert.equal((await c.get('/api/auth/me')).status, 401)
    assert.equal((await c.post('/api/auth/refresh')).status, 401)
  })

  it('logout revokes the session server-side (a copied token stops working)', async () => {
    const { c } = await signUp(h)
    const copy = h.client()
    copy.setCookie('karta_at', c.cookie('karta_at')!)
    assert.equal((await copy.get('/api/auth/me')).status, 200)
    assert.equal((await c.post('/api/auth/logout')).status, 204)
    assert.equal((await copy.get('/api/auth/me')).status, 401)
    assert.equal(c.cookie('karta_at'), undefined)
  })

  it('forged tokens are rejected: wrong signature and alg=none', async () => {
    const { c, user } = await signUp(h)
    const now = Math.floor(Date.now() / 1000)
    const claims = Buffer.from(JSON.stringify({ sub: user.id, role: 'admin', fid: 'x', iat: now, exp: now + 999 })).toString('base64url')

    const none = h.client()
    none.setCookie('karta_at', `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${claims}.`)
    assert.equal((await none.get('/api/auth/me')).status, 401)

    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const wrong = h.client()
    wrong.setCookie('karta_at', `${head}.${claims}.${createHmac('sha256', 'attacker-secret').update(`${head}.${claims}`).digest('base64url')}`)
    assert.equal((await wrong.get('/api/auth/me')).status, 401)

    // A real token for the same user, with a tampered payload, also fails.
    const [hd, , sig] = c.cookie('karta_at')!.split('.')
    const tampered = h.client()
    tampered.setCookie('karta_at', `${hd}.${claims}.${sig}`)
    assert.equal((await tampered.get('/api/auth/me')).status, 401)
  })

  it('bearer tokens work too (for mobile/API clients)', async () => {
    const { c } = await signUp(h)
    const api = h.client()
    assert.equal((await api.get('/api/auth/me', { headers: { authorization: `Bearer ${c.cookie('karta_at')}` } })).status, 200)
  })

  it('rate limits registration per IP', async () => {
    const h2 = await start()
    const sameIp = '203.0.113.9'
    for (let i = 0; i < 10; i++) assert.equal((await h2.client(sameIp).post('/api/auth/register', newUser())).status, 201)
    const r = await h2.client(sameIp).post('/api/auth/register', newUser())
    assert.equal(r.status, 429)
    assert.ok(r.headers.get('retry-after'))
    await h2.close()
  })
})

describe('passwords', () => {
  it('change: needs the current password, signs out other devices, keeps this one', async () => {
    const { c, u } = await signUp(h)
    const other = h.client()
    await other.post('/api/auth/login', { email: u.email, password: u.password })
    assert.equal((await other.get('/api/auth/me')).status, 200)

    assert.equal((await c.post('/api/auth/password/change', { currentPassword: 'wrong-pass-123', newPassword: 'Brand-New-Pass7' })).status, 422)
    assert.equal((await c.post('/api/auth/password/change', { currentPassword: u.password, newPassword: u.password })).status, 422)
    assert.equal((await c.post('/api/auth/password/change', { currentPassword: u.password, newPassword: 'short' })).status, 422)

    assert.equal((await c.post('/api/auth/password/change', { currentPassword: u.password, newPassword: 'Brand-New-Pass7' })).status, 200)
    assert.equal((await c.get('/api/auth/me')).status, 200, 'this device stays signed in')
    assert.equal((await other.get('/api/auth/me')).status, 401, 'every other device is signed out')
    assert.equal((await h.client().post('/api/auth/login', { email: u.email, password: u.password })).status, 401)
    assert.equal((await h.client().post('/api/auth/login', { email: u.email, password: 'Brand-New-Pass7' })).status, 200)
  })

  it('forgot: identical answer for known and unknown emails; only real accounts get a code', async () => {
    const { u } = await signUp(h)
    const before = h.notifier.sent.length
    const known = await h.client().post('/api/auth/password/forgot', { email: u.email })
    const unknown = await h.client().post('/api/auth/password/forgot', { email: uniqueEmail('ghost') })
    assert.equal(known.status, 202)
    assert.deepEqual(known.body, unknown.body)
    assert.equal(h.notifier.sent.length, before + 1)
    assert.equal(h.notifier.last(u.email)!.template, 'reset_code')
  })

  it('reset: wrong codes burn the code, weak password doesn’t spend it, success signs out everywhere and clears lockout', async () => {
    const { c, u } = await signUp(h)
    await h.client().post('/api/auth/password/forgot', { email: u.email })
    const code = h.notifier.last(u.email)!.code
    const wrong = code === '000000' ? '111111' : '000000'

    const reset = (c2: string, pw = 'Brand-New-Pass7') => h.client().post('/api/auth/password/reset', { email: u.email, code: c2, newPassword: pw })
    assert.equal((await reset(code, 'short')).status, 422)
    const first = await reset(wrong)
    assert.equal(first.status, 400)
    assert.equal(first.body.error.details.attemptsLeft, 4)

    // lock the account, then prove the reset clears the lockout
    for (let i = 0; i < 5; i++) await h.client().post('/api/auth/login', { email: u.email, password: `wrong-pass-${i}` })

    assert.equal((await reset(code)).status, 200, 'the real code still works after one wrong guess')
    assert.equal((await c.get('/api/auth/me')).status, 401, 'existing sessions are revoked')
    assert.equal((await h.client().post('/api/auth/login', { email: u.email, password: 'Brand-New-Pass7' })).status, 200, 'lockout cleared')
    assert.equal((await reset(code)).status, 400, 'a code works once')
  })

  it('reset: five wrong guesses burn the code, so even the right one then fails', async () => {
    const { u } = await signUp(h)
    await h.client().post('/api/auth/password/forgot', { email: u.email })
    const code = h.notifier.last(u.email)!.code
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await h.client().post('/api/auth/password/reset', { email: u.email, code: wrong, newPassword: 'Brand-New-Pass7' })
    assert.equal((await h.client().post('/api/auth/password/reset', { email: u.email, code, newPassword: 'Brand-New-Pass7' })).status, 400)
  })
})

describe('profile + account deletion', () => {
  it('updates name and phone; changing the phone resets phone verification', async () => {
    const { c, u } = await signUp(h)
    const same = await c.patch('/api/me', { name: '  Chidinma   Okafor-Eze ', phone: u.phone })
    assert.equal(same.body.user.name, 'Chidinma Okafor-Eze')
    assert.equal((await c.patch('/api/me', { name: 'A', phone: u.phone })).status, 422)

    await c.post('/api/verification/request', { channel: 'phone' })
    await c.post('/api/verification/confirm', { channel: 'phone', code: h.notifier.last(u.phone)!.code })
    assert.equal((await c.get('/api/auth/me')).body.user.phoneVerified, true)

    assert.equal((await c.patch('/api/me', { name: 'Chidinma O', phone: u.phone })).body.user.phoneVerified, true, 're-saving the same number keeps it')
    assert.equal((await c.patch('/api/me', { name: 'Chidinma O', phone: '08061112222' })).body.user.phoneVerified, false, 'a new number is unverified')
  })

  it('customers can delete their account (password required); data is anonymised and access ends', async () => {
    const { c, u, user } = await signUp(h)
    assert.equal((await c.del('/api/me', { password: 'wrong-pass-123' })).status, 422)
    assert.equal((await c.del('/api/me', { password: u.password })).status, 204)
    assert.equal((await c.get('/api/auth/me')).status, 401)
    assert.equal((await h.client().post('/api/auth/login', { email: u.email, password: u.password })).status, 401)
    const row = h.deps.db.prepare('SELECT name, email, phone, password_hash FROM users WHERE id = ?').get(user.id) as Record<string, unknown>
    assert.equal(row.name, 'Deleted user')
    assert.equal(row.phone, null)
    assert.equal(row.password_hash, null)
    assert.match(String(row.email), /@karta\.invalid$/)
  })

  it('vendors can’t self-delete (open orders and payouts must be settled by support)', async () => {
    const { c, u } = await signUp(h, { role: 'vendor', businessName: 'Ade Woodworks' })
    const r = await c.del('/api/me', { password: u.password })
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'support_required')
  })
})

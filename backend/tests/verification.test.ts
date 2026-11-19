import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { signUp, start, type Harness } from './harness.ts'

let h: Harness
before(async () => { h = await start() })
after(async () => { await h.close() })

const wrongFor = (code: string) => (code === '000000' ? '111111' : '000000')

describe('verification codes', () => {
  it('requires a signed-in user', async () => {
    assert.equal((await h.client().post('/api/verification/request', { channel: 'phone' })).status, 401)
    assert.equal((await h.client().post('/api/verification/confirm', { channel: 'phone', code: '123456' })).status, 401)
  })

  it('the SERVER chooses the target: it always uses the account’s own phone/email', async () => {
    const { c, u } = await signUp(h)
    // A client-supplied "target" is simply ignored.
    const r = await c.post('/api/verification/request', { channel: 'phone', target: '08099999999', to: '08099999999' })
    assert.equal(r.status, 200)
    assert.equal(r.body.to, u.phone)
    assert.equal(h.notifier.last(u.phone)!.channel, 'sms')
    assert.equal(h.notifier.last('08099999999'), undefined)
    assert.match(h.notifier.last(u.phone)!.code, /^\d{6}$/)
  })

  it('email codes go to email; the code is never returned unless dev exposure is on', async () => {
    const { c, u } = await signUp(h)
    const r = await c.post('/api/verification/request', { channel: 'email' })
    assert.equal(h.notifier.last(u.email)!.channel, 'email')
    assert.equal(r.body.devCode, undefined)
  })

  it('stores only a hash of the code', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'phone' })
    const code = h.notifier.last(u.phone)!.code
    const rows = h.deps.db.prepare('SELECT code_hash, salt FROM verification_codes').all() as { code_hash: string; salt: string }[]
    assert.ok(rows.length > 0)
    assert.ok(rows.every((r) => !r.code_hash.includes(code) && r.code_hash.length === 64))
  })

  it('confirming marks the channel verified, and only that channel', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'phone' })
    const ok = await c.post('/api/verification/confirm', { channel: 'phone', code: h.notifier.last(u.phone)!.code })
    assert.equal(ok.status, 200)
    const me = (await c.get('/api/auth/me')).body.user
    assert.equal(me.phoneVerified, true)
    assert.equal(me.emailVerified, false)
    assert.equal((await c.post('/api/verification/request', { channel: 'phone' })).status, 409, 'already verified')
  })

  it('an email code cannot verify a phone', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'email' })
    const r = await c.post('/api/verification/confirm', { channel: 'phone', code: h.notifier.last(u.email)!.code })
    assert.equal(r.status, 400)
    assert.equal((await c.get('/api/auth/me')).body.user.phoneVerified, false)
  })

  it('a code works once', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'email' })
    const code = h.notifier.last(u.email)!.code
    assert.equal((await c.post('/api/verification/confirm', { channel: 'email', code })).status, 200)
    assert.equal((await c.post('/api/verification/confirm', { channel: 'email', code })).status, 400)
  })

  it('one user cannot use another user’s code', async () => {
    const a = await signUp(h)
    const b = await signUp(h)
    await a.c.post('/api/verification/request', { channel: 'phone' })
    const stolen = h.notifier.last(a.u.phone)!.code
    const r = await b.c.post('/api/verification/confirm', { channel: 'phone', code: stolen })
    assert.equal(r.status, 400)
    assert.equal((await b.c.get('/api/auth/me')).body.user.phoneVerified, false)
  })

  it('wrong guesses count down, and five burn the code (even the right one then fails)', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'phone' })
    const code = h.notifier.last(u.phone)!.code
    const wrong = wrongFor(code)

    const first = await c.post('/api/verification/confirm', { channel: 'phone', code: wrong })
    assert.equal(first.body.error.details.attemptsLeft, 4)
    for (let i = 0; i < 4; i++) await c.post('/api/verification/confirm', { channel: 'phone', code: wrong })
    assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code })).status, 400)
    assert.equal((await c.get('/api/auth/me')).body.user.phoneVerified, false)
  })

  it('codes expire after 10 minutes', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'phone' })
    const code = h.notifier.last(u.phone)!.code
    h.advance(10 * 60_000 + 1000)
    assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code })).status, 400)
  })

  it('enforces a 60-second wait between codes, and a new code cancels the old one', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'phone' })
    const old = h.notifier.last(u.phone)!.code
    const again = await c.post('/api/verification/request', { channel: 'phone' })
    assert.equal(again.status, 429)
    assert.ok(Number(again.headers.get('retry-after')) > 0)

    h.advance(61_000)
    assert.equal((await c.post('/api/verification/request', { channel: 'phone' })).status, 200)
    const fresh = h.notifier.last(u.phone)!.code
    if (fresh !== old) assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code: old })).status, 400, 'the old code is dead')
    assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code: fresh })).status, 200)
  })

  it('caps sends at 5 per hour per target', async () => {
    const { c } = await signUp(h)
    for (let i = 0; i < 5; i++) {
      assert.equal((await c.post('/api/verification/request', { channel: 'email' })).status, 200)
      h.advance(61_000)
    }
    const r = await c.post('/api/verification/request', { channel: 'email' })
    assert.equal(r.status, 429)
    assert.match(r.body.error.message, /hour/)
    h.advance(3_600_000)
    await c.post('/api/auth/refresh') // an hour later the 15-minute access token has expired, as in a real browser
    assert.equal((await c.post('/api/verification/request', { channel: 'email' })).status, 200)
  })

  it('validates the channel and code format', async () => {
    const { c } = await signUp(h)
    assert.equal((await c.post('/api/verification/request', { channel: 'pigeon' })).status, 422)
    assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code: '' })).status, 422)
    assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code: '12ab' })).status, 400)
  })

  it('changing your phone invalidates earlier codes and verification', async () => {
    const { c, u } = await signUp(h)
    await c.post('/api/verification/request', { channel: 'phone' })
    const oldCode = h.notifier.last(u.phone)!.code
    await c.patch('/api/me', { name: 'Chidinma O', phone: '08061112222' })
    assert.equal((await c.post('/api/verification/confirm', { channel: 'phone', code: oldCode })).status, 400, 'a code for the OLD number is useless')
  })

  it('exposes dev codes only when explicitly enabled (never in production)', async () => {
    const dev = await start({ EXPOSE_DEV_CODES: 'true' })
    const { c } = await signUp(dev)
    const r = await c.post('/api/verification/request', { channel: 'phone' })
    assert.match(r.body.devCode, /^\d{6}$/)
    await dev.close()
  })
})

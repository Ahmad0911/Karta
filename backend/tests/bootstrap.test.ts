import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { bootstrapAdmin } from '../src/modules/auth/bootstrapAdmin.ts'
import { start, type Harness } from './harness.ts'

let h: Harness
before(async () => { h = await start() })
after(async () => { await h.close() })
const ok = { BOOTSTRAP_ADMIN_EMAIL: 'Boss@Karta.test', BOOTSTRAP_ADMIN_NAME: 'The Boss', BOOTSTRAP_ADMIN_PASSWORD: 'Cedar-Lantern-Quartz-81' }

describe('first-admin bootstrap (for hosts with no terminal)', () => {
  it('does nothing when the settings are absent', async () => {
    assert.equal(await bootstrapAdmin(h.deps, {}), 'skipped')
  })
  it('refuses half-filled or weak settings', async () => {
    assert.equal(await bootstrapAdmin(h.deps, { BOOTSTRAP_ADMIN_EMAIL: 'a@b.test' }), 'invalid')
    assert.equal(await bootstrapAdmin(h.deps, { ...ok, BOOTSTRAP_ADMIN_PASSWORD: 'password123' }), 'invalid')
    assert.equal(h.deps.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get()?.n, 0)
  })
  it('creates the first admin, who can sign in', async () => {
    assert.equal(await bootstrapAdmin(h.deps, ok), 'created')
    const c = h.client()
    const r = await c.post('/api/auth/login', { email: 'boss@karta.test', password: ok.BOOTSTRAP_ADMIN_PASSWORD })
    assert.equal(r.status, 200); assert.equal(r.body.user.role, 'admin')
  })
  it('then does nothing: it can never reset a password or add a second admin', async () => {
    assert.equal(await bootstrapAdmin(h.deps, ok), 'skipped')
    assert.equal(await bootstrapAdmin(h.deps, { ...ok, BOOTSTRAP_ADMIN_EMAIL: 'other@karta.test', BOOTSTRAP_ADMIN_PASSWORD: 'Another-Long-Phrase-4471' }), 'skipped')
    assert.equal(h.deps.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get()?.n, 1)
  })
})

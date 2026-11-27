import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadConfig } from '../src/config.ts'

const prod = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGINS: 'https://karta.example', NOTIFIER: 'live', TERMII_API_KEY: 'tk_test', TERMII_SENDER_ID: 'Karta', RESEND_API_KEY: 're_test', EMAIL_FROM: 'Karta <hello@karta.example>', DATABASE_PATH: '/var/data/karta.db' }

describe('configuration safety', () => {
  it('a correct production config loads, with Secure cookies and no dev codes', () => {
    const c = loadConfig(prod)
    assert.equal(c.cookieSecure, true)
    assert.equal(c.exposeDevCodes, false)
    assert.equal(c.scryptN, 2 ** 15)
  })

  for (const [name, change, expected] of [
    ['a missing JWT secret', { JWT_SECRET: '' }, /JWT_SECRET/],
    ['a short JWT secret', { JWT_SECRET: 'short' }, /JWT_SECRET/],
    ['the console notifier (prints codes to logs)', { NOTIFIER: 'console' }, /NOTIFIER must be "live"/],
    ['exposing dev codes', { EXPOSE_DEV_CODES: 'true' }, /EXPOSE_DEV_CODES/],
    ['an in-memory database', { DATABASE_PATH: ':memory:' }, /:memory:/],
    ['http origins', { CORS_ORIGINS: 'http://karta.example' }, /https/],
    ['a wildcard origin', { CORS_ORIGINS: '*' }, /exact origins/],
  ] as [string, Record<string, string>, RegExp][]) {
    it(`refuses to start in production with ${name}`, () => {
      assert.throws(() => loadConfig({ ...prod, ...change }), expected)
    })
  }

  it('lists every problem at once', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), (e: Error) => /JWT_SECRET/.test(e.message) && /NOTIFIER/.test(e.message))
  })

  it('rejects an unknown NODE_ENV', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'staging' }), /NODE_ENV/)
  })

  it('development has friendly defaults', () => {
    const c = loadConfig({})
    assert.equal(c.env, 'development')
    assert.equal(c.cookieSecure, false)
    assert.equal(c.port, 3000)
  })
})

describe('Paystack configuration', () => {
  const prod = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), NOTIFIER: 'live', TERMII_API_KEY: 'tk_test', TERMII_SENDER_ID: 'Karta', RESEND_API_KEY: 're_test', EMAIL_FROM: 'Karta <hello@karta.example>', CORS_ORIGINS: 'https://karta.example' }
  it('rejects a public key where the secret belongs', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'test', PAYSTACK_SECRET_KEY: 'pk_test_abc' }), /PAYSTACK_SECRET_KEY/)
  })
  it('requires a live key in production, but allows payments to be off', () => {
    assert.throws(() => loadConfig({ ...prod, PAYSTACK_SECRET_KEY: 'sk_test_abc123' }), /live key/)
    assert.equal(loadConfig({ ...prod, PAYSTACK_SECRET_KEY: 'sk_live_abc123' }).paystackSecretKey, 'sk_live_abc123')
    assert.equal(loadConfig(prod).paystackSecretKey, '')
  })
})

describe('live notifier configuration', () => {
  const base = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGINS: 'https://karta.example', DATABASE_PATH: '/var/data/karta.db' }
  it('production refuses "none" (codes would silently never arrive)', () => {
    assert.throws(() => loadConfig({ ...base, NOTIFIER: 'none' }), /must be "live"/)
  })
  it('live needs every provider setting, and names what is missing', () => {
    assert.throws(() => loadConfig({ ...base, NOTIFIER: 'live', TERMII_API_KEY: 'k' }), (e: Error) => /TERMII_SENDER_ID/.test(e.message) && /RESEND_API_KEY/.test(e.message) && /EMAIL_FROM/.test(e.message))
  })
  it('validates the sender address and SMS route', () => {
    const ok = { ...base, NOTIFIER: 'live', TERMII_API_KEY: 'k', TERMII_SENDER_ID: 'Karta', RESEND_API_KEY: 'r' }
    assert.throws(() => loadConfig({ ...ok, EMAIL_FROM: 'not-an-email' }), /EMAIL_FROM/)
    assert.throws(() => loadConfig({ ...ok, EMAIL_FROM: 'hello@karta.example', TERMII_CHANNEL: 'whatsapp' }), /TERMII_CHANNEL/)
    const c = loadConfig({ ...ok, EMAIL_FROM: 'Karta <hello@karta.example>' })
    assert.equal(c.live?.termii.channel, 'dnd')
  })
})

describe('staging mode', () => {
  const base = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGINS: 'https://karta.example', DATABASE_PATH: '/data/karta.db' }
  it('allows a Paystack test key and printed codes, but stays production-strict otherwise', () => {
    const c = loadConfig({ ...base, STAGING: 'true', NOTIFIER: 'console', PAYSTACK_SECRET_KEY: 'sk_test_abc123' })
    assert.equal(c.staging, true); assert.equal(c.cookieSecure, true); assert.equal(c.exposeDevCodes, false)
    assert.throws(() => loadConfig({ ...base, STAGING: 'true', NOTIFIER: 'console', JWT_SECRET: 'short' }), /JWT_SECRET/)
    assert.throws(() => loadConfig({ ...base, STAGING: 'true', NOTIFIER: 'console', CORS_ORIGINS: 'http://karta.example' }), /https/)
  })
  it('refuses to mix staging with live money', () => {
    assert.throws(() => loadConfig({ ...base, STAGING: 'true', NOTIFIER: 'console', PAYSTACK_SECRET_KEY: 'sk_live_abc123' }), /live Paystack key/)
  })
  it('without STAGING, production still demands live keys and real SMS/email', () => {
    assert.throws(() => loadConfig({ ...base, NOTIFIER: 'console', PAYSTACK_SECRET_KEY: 'sk_test_abc123' }), (e: Error) => /live key/.test(e.message) && /must be "live"/.test(e.message))
  })
  it('STAGING is ignored outside production', () => {
    assert.equal(loadConfig({ NODE_ENV: 'development', STAGING: 'true' }).staging, false)
  })
})

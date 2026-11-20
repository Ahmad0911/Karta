import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createLiveNotifier, toInternationalNg } from '../src/platform/notifier.ts'
import { signUp, start } from './harness.ts'

const cfg = { termii: { apiKey: 'TERMII-SECRET', senderId: 'Karta', channel: 'dnd' as const }, resend: { apiKey: 're_SECRET', from: 'Karta <hello@karta.example>' } }

function fakeFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{}', { status }) }) as unknown as typeof fetch
  return { f, calls }
}

describe('phone formatting for Termii', () => {
  it('turns every Nigerian format into 234…', () => {
    for (const p of ['08031234567', '+2348031234567', '2348031234567', '0803 123 4567', '803-123-4567']) assert.equal(toInternationalNg(p), '2348031234567')
  })
})

describe('live notifier', () => {
  it('sends SMS through Termii with the code in the text', async () => {
    const { f, calls } = fakeFetch()
    await createLiveNotifier(cfg, f).send({ channel: 'sms', to: '08031234567', template: 'verify_code', code: '123456' })
    const body = JSON.parse(calls[0]!.init.body as string)
    assert.equal(calls[0]!.url, 'https://api.ng.termii.com/api/sms/send')
    assert.equal(body.to, '2348031234567'); assert.equal(body.from, 'Karta'); assert.equal(body.channel, 'dnd'); assert.equal(body.api_key, 'TERMII-SECRET')
    assert.match(body.sms, /123456/); assert.match(body.sms, /never share/i)
  })
  it('sends email through Resend with a bearer key', async () => {
    const { f, calls } = fakeFetch()
    await createLiveNotifier(cfg, f).send({ channel: 'email', to: 'ade@mail.com', template: 'reset_code', code: '654321' })
    const body = JSON.parse(calls[0]!.init.body as string)
    assert.equal(calls[0]!.url, 'https://api.resend.com/emails')
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer re_SECRET')
    assert.deepEqual(body.to, ['ade@mail.com']); assert.match(body.text, /654321/); assert.match(body.subject, /password/i)
  })
  it('errors never contain keys, numbers, addresses or codes', async () => {
    const { f } = fakeFetch(401)
    for (const m of [{ channel: 'sms', to: '08031234567' }, { channel: 'email', to: 'ade@mail.com' }] as const) {
      await assert.rejects(createLiveNotifier(cfg, f).send({ ...m, template: 'verify_code', code: '123456' }), (e: Error) =>
        !/SECRET|08031234567|ade@mail|123456/.test(e.message) && /rejected/.test(e.message))
    }
  })
  it('a network failure is reported without leaking details', async () => {
    const boom = (async () => { throw new Error('connect ECONNREFUSED 10.0.0.1 key=TERMII-SECRET') }) as unknown as typeof fetch
    await assert.rejects(createLiveNotifier(cfg, boom).send({ channel: 'sms', to: '08031234567', template: 'verify_code', code: '1' }), (e: Error) => !/SECRET|10\.0\.0\.1/.test(e.message))
  })
})

describe('when delivery fails', () => {
  it('the person gets a friendly error and may retry immediately', async () => {
    let fail = true
    const sent: string[] = []
    const notifier = { async send(m: { to: string; code: string }) { if (fail) throw new Error('provider down: key=SECRET'); sent.push(m.code) } }
    const h = await start({}, { notifier })
    try {
      const { c, u } = await signUp(h)
      const first = await c.post('/api/verification/request', { channel: 'phone' })
      assert.equal(first.status, 502)
      assert.ok(!JSON.stringify(first.body).includes('SECRET'))
      assert.match(first.body.error.message, /couldn’t send/)
      fail = false
      // no 60-second wait: the failed attempt never counted
      const retry = await c.post('/api/verification/request', { channel: 'phone' })
      assert.equal(retry.status, 200, JSON.stringify(retry.body))
      assert.equal(sent.length, 1)
      void u
    } finally { await h.close() }
  })
})

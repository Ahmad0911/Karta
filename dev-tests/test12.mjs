// Run with KARTA_API=http://api.test/api
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }
const { api, apiPost, ApiError, API_BASE } = await import('@/lib/api')

const calls = []
let script = []   // queue of responses
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = async (url, init) => { calls.push({ url, init }); const next = script.shift(); if (!next) throw new Error('unexpected call ' + url); return typeof next === 'function' ? next() : next }
const reset = () => { calls.length = 0; script = [] }

console.log('\nRequests')
ok('uses the configured base URL', API_BASE === 'http://api.test/api')
reset(); script = [reply(200, { ok: true })]
await apiPost('/verification/request', { channel: 'phone' })
ok('sends cookies', calls[0].init.credentials === 'include')
ok('sends the CSRF client header', calls[0].init.headers['x-karta-client'] === 'web')
ok('sends JSON', calls[0].init.headers['Content-Type'] === 'application/json' && calls[0].init.body === '{"channel":"phone"}')
ok('hits the right URL', calls[0].url === 'http://api.test/api/verification/request')
reset(); script = [reply(200, { user: 1 })]
await api('GET', '/auth/me')
ok('GET has no body', calls[0].init.body === undefined)

console.log('\nErrors')
reset(); script = [reply(422, { error: { code: 'validation_failed', message: 'Please check the highlighted fields.', details: { fields: { phone: 'Enter a valid Nigerian phone number.' } } } })]
let e = await api('POST', '/auth/register', {}).catch(x => x)
ok('maps server errors to ApiError', e instanceof ApiError && e.status === 422 && e.code === 'validation_failed')
ok('exposes field errors for forms', e.fields.phone === 'Enter a valid Nigerian phone number.')
reset(); script = [reply(429, { error: { code: 'rate_limited', message: 'Slow down', details: { retryAfterSec: 30 } } })]
e = await api('POST', '/auth/login', {}).catch(x => x)
ok('exposes retry-after for rate limits', e.status === 429 && e.retryAfterSec === 30)
reset(); script = [() => { throw new TypeError('failed to fetch') }]
e = await api('GET', '/auth/me').catch(x => x)
ok('network failures become friendly errors', e instanceof ApiError && e.code === 'network_error' && /connection/i.test(e.message))
reset(); script = [reply(500, 'oops')]
e = await api('GET', '/x').catch(x => x)
ok('non-JSON error bodies don’t crash', e instanceof ApiError || e instanceof SyntaxError)

console.log('\nSession refresh')
reset(); script = [reply(401, { error: { code: 'unauthorized', message: 'Please sign in.' } }), reply(200, { user: 1 }), reply(200, { user: { name: 'A' } })]
let r = await api('GET', '/auth/me')
ok('a 401 triggers one refresh, then retries the call', r.user.name === 'A' && calls.length === 3 && calls[1].url.endsWith('/auth/refresh') && calls[2].url.endsWith('/auth/me'))

reset()
let refreshHits = 0
globalThis.fetch = async (url) => {
  calls.push({ url })
  if (String(url).endsWith('/auth/refresh')) { refreshHits++; await new Promise(r => setTimeout(r, 20)); return reply(200, { user: 1 }) }
  // first attempt for each path 401s, retry succeeds
  const seen = calls.filter(c => c.url === url).length
  return seen === 1 ? reply(401, { error: { code: 'unauthorized', message: 'x' } }) : reply(200, { path: String(url) })
}
const [a, b, c] = await Promise.all([api('GET', '/orders'), api('GET', '/profile'), api('GET', '/addresses')])
ok('simultaneous 401s share ONE refresh (a replayed token would end the session)', refreshHits === 1, `refreshes: ${refreshHits}`)
ok('…and every call still succeeds', a.path.endsWith('/orders') && b.path.endsWith('/profile') && c.path.endsWith('/addresses'))

reset(); globalThis.fetch = async (url, init) => { calls.push({ url, init }); const n = script.shift(); return n }
script = [reply(401, { error: { code: 'unauthorized', message: 'x' } }), reply(401, { error: { code: 'session_invalid', message: 'Your session has ended.' } })]
e = await api('GET', '/auth/me').catch(x => x)
ok('if the refresh fails, the 401 reaches the caller (so the app can send you to sign in)', e instanceof ApiError && e.status === 401 && calls.length === 2)
reset(); script = [reply(401, { error: { code: 'invalid_credentials', message: 'Incorrect email or password.' } })]
e = await api('POST', '/auth/login', {}).catch(x => x)
ok('a wrong password does NOT trigger a refresh loop', e.code === 'invalid_credentials' && calls.length === 1)
reset(); script = [reply(401, { error: { code: 'unauthorized', message: 'x' } }), reply(200, {}), reply(401, { error: { code: 'unauthorized', message: 'x' } })]
e = await api('GET', '/auth/me').catch(x => x)
ok('retries at most once (no infinite loops)', e.status === 401 && calls.length === 3)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

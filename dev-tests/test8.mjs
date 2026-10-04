// Run WITHOUT KARTA_DEV (production build behaviour)
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }
const { getVerificationProvider } = await import('@/modules/verification')
const { resolvePaymentProvider } = await import('@/modules/payments')
console.log('\nProduction build behaviour')
const p = getVerificationProvider()
ok('production never uses the fake verification provider', p?.id !== 'mock')
ok('without an API it fails safely instead of "verifying"', (await p.request('phone', '08035551234')).ok === false && (await p.confirm('phone', '08035551234', '123456')).ok === false)
const pay = resolvePaymentProvider()
ok('production never uses the fake payment gateway', pay.ok === false)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

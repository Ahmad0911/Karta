import { createHash } from 'node:crypto'
const { sha256Hex } = await import('@/lib/sha256')
const { uuid } = await import('@/lib/id')
let bad = 0
const cases = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(119), 'a'.repeat(1000), 'Tr1cky-Walnut-Table', 'Ünïcödé ✓ 🙂']
for (const c of cases) {
  const want = createHash('sha256').update(c).digest('hex')
  if (sha256Hex(c) !== want) { bad++; console.log('MISMATCH len', c.length) }
}
console.log(bad ? `${bad} FAILED` : `sha256 matches Node on ${cases.length} inputs`)
// force the no-crypto path for uuid
const saved = globalThis.crypto
Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
const ids = new Set(Array.from({ length: 500 }, () => uuid()))
const fmt = [...ids].every(i => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i))
Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true })
console.log(ids.size === 500 && fmt ? 'uuid fallback: 500 unique, valid v4 format' : 'uuid FAILED')
process.exit(bad || !(ids.size === 500 && fmt) ? 1 : 0)

import { invalid } from './errors.ts'

/**
 * A tiny schema library: every field is checked, trimmed and typed, and unknown
 * fields are dropped (so clients can't smuggle in "role" or "status").
 * A Schema returns either a value or a human-readable problem.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
export type Schema<T> = (input: unknown) => Result<T>

const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const bad = (error: string): Result<never> => ({ ok: false, error })

export const str = (o: { min?: number; max?: number; pattern?: RegExp; message?: string; label?: string } = {}): Schema<string> => (x) => {
  if (typeof x !== 'string') return bad(`${o.label ?? 'This'} is required.`)
  const s = x.trim()
  if (o.min !== undefined && s.length < o.min) return bad(o.message ?? `${o.label ?? 'This'} must be at least ${o.min} characters.`)
  if (s.length > (o.max ?? 500)) return bad(`${o.label ?? 'This'} must be at most ${o.max ?? 500} characters.`)
  if (o.pattern && !o.pattern.test(s)) return bad(o.message ?? 'That doesn’t look right.')
  return ok(s)
}

export const email = (): Schema<string> => (x) => {
  const r = str({ max: 254 })(x)
  if (!r.ok || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.value)) return bad('Enter a valid email address.')
  return ok(r.value.toLowerCase())
}

const NG_PHONE = /^(?:\+?234|0)[789][01]\d{8}$/
export const cleanPhone = (v: string) => v.replace(/[\s()-]/g, '')
export const phoneNg = (): Schema<string> => (x) => {
  const r = str({ max: 30 })(x)
  if (!r.ok || !NG_PHONE.test(cleanPhone(r.value))) return bad('Enter a valid Nigerian phone number, for example 0803 123 4567.')
  return ok(r.value)
}

/** Canonical form for comparing phones: 234XXXXXXXXXX. */
export function normalisePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('234')) return d
  if (d.startsWith('0')) return `234${d.slice(1)}`
  return d
}

export const int = (o: { min?: number; max?: number } = {}): Schema<number> => (x) => {
  if (typeof x !== 'number' || !Number.isInteger(x)) return bad('Enter a whole number.')
  if (o.min !== undefined && x < o.min) return bad(`Must be at least ${o.min}.`)
  if (o.max !== undefined && x > o.max) return bad(`Must be at most ${o.max}.`)
  return ok(x)
}

export const bool = (): Schema<boolean> => (x) => (typeof x === 'boolean' ? ok(x) : bad('Must be true or false.'))

export const oneOf = <const T extends readonly string[]>(list: T): Schema<T[number]> => (x) =>
  typeof x === 'string' && (list as readonly string[]).includes(x) ? ok(x as T[number]) : bad(`Must be one of: ${list.join(', ')}.`)

export const optional = <T>(s: Schema<T>): Schema<T | undefined> => (x) => (x === undefined || x === null || x === '' ? ok(undefined) : s(x))

export const array = <T>(s: Schema<T>, o: { max?: number } = {}): Schema<T[]> => (x) => {
  if (!Array.isArray(x)) return bad('Must be a list.')
  if (x.length > (o.max ?? 50)) return bad(`At most ${o.max ?? 50} items.`)
  const out: T[] = []
  for (const item of x) {
    const r = s(item)
    if (!r.ok) return r
    out.push(r.value)
  }
  return ok(out)
}

type Shape = Record<string, Schema<unknown>>
type Infer<S extends Shape> = { [K in keyof S]: S[K] extends Schema<infer U> ? U : never }

export const object = <S extends Shape>(shape: S): Schema<Infer<S>> => (x) => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return bad('Expected an object.')
  const out: Record<string, unknown> = {}
  const errors: string[] = []
  for (const [k, s] of Object.entries(shape)) {
    const r = s((x as Record<string, unknown>)[k])
    if (r.ok) out[k] = r.value
    else errors.push(`${k}: ${r.error}`)
  }
  return errors.length ? bad(errors.join(' ')) : ok(out as Infer<S>)
}

/** Parses a request body field-by-field and throws a 422 listing every problem. */
export function parse<S extends Shape>(shape: S, input: unknown): Infer<S> {
  const src = typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  const fields: Record<string, string> = {}
  for (const [k, s] of Object.entries(shape)) {
    const r = s(src[k])
    if (r.ok) out[k] = r.value
    else fields[k] = r.error
  }
  if (Object.keys(fields).length) throw invalid(fields)
  return out as Infer<S>
}

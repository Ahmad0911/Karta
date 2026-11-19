import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'

/* -------------------------------------------------------------------------- */
/* Passwords: scrypt (memory-hard). Hash format is self-describing so the     */
/* cost can be raised later without breaking existing users.                  */
/*   scrypt$N$r$p$salt(b64url)$hash(b64url)                                   */
/* -------------------------------------------------------------------------- */

const KEYLEN = 32
const R = 8
const P = 1

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, { N: n, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPassword(password: string, n: number): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, n, R, P)
  return `scrypt$${n}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** A real hash nobody knows the password of. Checked for unknown emails so timing doesn't reveal them. */
let dummy: Promise<string> | undefined
export const dummyHash = (n: number) => (dummy ??= hashPassword(randomBytes(24).toString('hex'), n))

/* -------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* -------------------------------------------------------------------------- */

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const newId = () => randomUUID()
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Uniform random numeric code (rejection sampling, so no modulo bias). */
export function randomDigits(length: number): string {
  let out = ''
  while (out.length < length) {
    const b = randomBytes(1)[0] as number
    if (b < 250) out += String(b % 10)
  }
  return out
}

/** Readable one-time password without look-alike characters (0/O, 1/l/I). */
export function tempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = letters + digits
  const b = randomBytes(12)
  const c = Array.from(b, (x) => all[x % all.length] as string)
  c[0] = letters[(b[0] as number) % letters.length] as string
  c[11] = digits[(b[11] as number) % digits.length] as string
  return `${c.slice(0, 4).join('')}-${c.slice(4, 8).join('')}-${c.slice(8).join('')}`
}

/* -------------------------------------------------------------------------- */
/* JWT (HS256), only what we need                                             */
/* -------------------------------------------------------------------------- */

export interface AccessClaims {
  sub: string
  role: string
  fid: string
  iat: number
  exp: number
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function signJwt(claims: AccessClaims, secret: string): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64(claims)
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

export function verifyJwt(token: string, secret: string, nowSec: number): AccessClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts as [string, string, string]

  // The algorithm is fixed by us, never read from the token ("alg: none" attacks).
  try {
    const h = JSON.parse(Buffer.from(head, 'base64url').toString())
    if (h.alg !== 'HS256' || h.typ !== 'JWT') return null
  } catch {
    return null
  }

  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')
  if (!safeEqual(sig, expected)) return null

  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as AccessClaims
    if (typeof c.sub !== 'string' || typeof c.fid !== 'string' || typeof c.exp !== 'number' || c.exp <= nowSec) return null
    return c
  } catch {
    return null
  }
}

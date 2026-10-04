/**
 * Password helpers for the MOCK auth store.
 *
 * IMPORTANT: hashing in the browser does not make a login secure. Anyone who
 * can read localStorage can read the hash and the salt. This exists so the
 * UI behaves like the real thing (wrong password → error, lockouts,
 * strength rules). Real passwords must be hashed (argon2/bcrypt) and checked
 * ONLY on the server, over HTTPS.
 */

import { sha256Hex } from './sha256'

const ITERATIONS = 100_000

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

export const newSalt = () => {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  return toHex(bytes.buffer)
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  // Plain http:// pages (not localhost) have no crypto.subtle. Fall back so the
  // prototype still works on a phone; the real server hashes with argon2.
  if (!globalThis.crypto?.subtle) return sha256Hex(`${salt}:${password}`)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    256,
  )

  return toHex(bits)
}

/** Constant-time comparison so timing doesn't leak how many characters matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'letmein123', 'karta123',
])

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 8) return 'Your password needs at least 8 characters.'
  if (password.length > 128) return 'Your password is too long (128 characters maximum).'
  if (/^\d+$/.test(password)) return 'Add some letters. A password of only numbers is easy to guess.'
  if (COMMON.has(password.toLowerCase())) return 'That password is too common. Please choose another.'

  const local = email.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return 'Your password shouldn’t contain your email name.'
  }

  return null
}

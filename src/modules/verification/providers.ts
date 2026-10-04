import { sha256Hex } from '@/lib/sha256'
import { newSalt } from '@/lib/password'
import { normalisePhone } from '@/lib/phone'
import { safeEqual } from '@/lib/password'
import {
  CODE_RULES,
  type Channel,
  type ConfirmResult,
  type RequestResult,
  type VerificationProvider,
} from './types'

/* -------------------------------------------------------------------------- */
/* DEV-ONLY mock: behaves like the real service, but "sends" nothing          */
/* -------------------------------------------------------------------------- */

interface Record_ {
  salt: string
  hash: string
  expiresAt: number
  attempts: number
  sends: number[]
}

const STORAGE_KEY = 'karta-otp'

const load = (): Record<string, Record_> => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}
const save = (data: Record<string, Record_>) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable: the mock then behaves as "no code was sent" */
  }
}

export const normaliseTarget = (channel: Channel, target: string) =>
  channel === 'email' ? target.trim().toLowerCase() : normalisePhone(target)

const keyOf = (channel: Channel, target: string) => `${channel}:${normaliseTarget(channel, target)}`

function randomCode(): string {
  const bytes = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else bytes[0] = Math.floor(Math.random() * 2 ** 32)
  return String(bytes[0] % 10 ** CODE_RULES.length).padStart(CODE_RULES.length, '0')
}

export const mockVerification: VerificationProvider = {
  id: 'mock',

  async request(channel, target): Promise<RequestResult> {
    const now = Date.now()
    const all = load()
    const k = keyOf(channel, target)
    const rec = all[k]

    const recent = (rec?.sends ?? []).filter((t) => now - t < 3_600_000)
    const last = recent[recent.length - 1]

    if (last && now - last < CODE_RULES.resendMs) {
      return { ok: false, error: 'Please wait a moment before requesting another code.', retryAfter: last + CODE_RULES.resendMs }
    }
    if (recent.length >= CODE_RULES.maxSendsPerHour) {
      return { ok: false, error: 'Too many codes requested. Try again in an hour.', retryAfter: recent[0] + 3_600_000 }
    }

    const code = randomCode()
    const salt = newSalt()

    all[k] = {
      salt,
      hash: sha256Hex(`${salt}:${code}`),
      expiresAt: now + CODE_RULES.ttlMs,
      attempts: 0,
      sends: [...recent, now],
    }
    save(all)

    return { ok: true, resendAfter: now + CODE_RULES.resendMs, devCode: import.meta.env.DEV ? code : undefined }
  },

  async confirm(channel, target, code): Promise<ConfirmResult> {
    const all = load()
    const k = keyOf(channel, target)
    const rec = all[k]
    const bad = { ok: false as const, error: 'That code isn’t right, or it has expired. Request a new one.' }

    if (!rec || rec.expiresAt < Date.now()) return bad

    if (!/^\d+$/.test(code) || code.length !== CODE_RULES.length) {
      return { ok: false, error: `Enter the ${CODE_RULES.length}-digit code.` }
    }

    if (!safeEqual(sha256Hex(`${rec.salt}:${code}`), rec.hash)) {
      rec.attempts += 1
      if (rec.attempts >= CODE_RULES.maxAttempts) {
        delete all[k] // burn it: brute force gets 5 guesses per code, not unlimited
        save(all)
        return { ok: false, error: 'Too many wrong attempts. Request a new code.' }
      }
      save(all)
      return { ok: false, error: `That code isn’t right. ${CODE_RULES.maxAttempts - rec.attempts} attempt(s) left.` }
    }

    delete all[k] // single use
    save(all)
    return { ok: true }
  },
}

/* -------------------------------------------------------------------------- */
/* Production: our API sends the SMS/email and checks the code                */
/* -------------------------------------------------------------------------- */
/**
 *   POST {API}/verification/request   { channel, target }
 *        → { resendAfter } | 429 { error, retryAfter }
 *   POST {API}/verification/confirm   { channel, target, code }
 *        → { ok: true } | 400 { error }
 */
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  if (!API) throw new Error('Verification isn’t available yet. Please try again later.')
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T }
}

export const httpVerification: VerificationProvider = {
  id: 'http',

  async request(channel, target) {
    try {
      const { status, data } = await post<{ resendAfter?: number; error?: string; retryAfter?: number }>('/verification/request', { channel, target })
      if (status >= 400) return { ok: false, error: data.error ?? 'We couldn’t send a code. Please try again.', retryAfter: data.retryAfter }
      return { ok: true, resendAfter: data.resendAfter ?? Date.now() + CODE_RULES.resendMs }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'We couldn’t send a code.' }
    }
  },

  async confirm(channel, target, code) {
    try {
      const { status, data } = await post<{ error?: string }>('/verification/confirm', { channel, target, code })
      return status >= 400 ? { ok: false, error: data.error ?? 'That code isn’t right.' } : { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'We couldn’t check that code.' }
    }
  },
}

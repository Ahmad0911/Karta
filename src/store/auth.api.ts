import { API_BASE, ApiError } from '@/lib/api'
import type { User } from '@/types'

/**
 * Real sign-in against the Karta API (httpOnly cookies, server-side roles).
 *
 *  - Production builds use it by default, so a production site can never fall back to the
 *    browser-only demo accounts. Set VITE_AUTH_PROVIDER=mock to opt out (never do that for real customers).
 *  - Development uses the demo accounts unless VITE_AUTH_PROVIDER=api (and the backend is running).
 */
const CONFIGURED = (import.meta.env.VITE_AUTH_PROVIDER as string | undefined)?.trim().toLowerCase()
export const AUTH_API: boolean = Boolean(API_BASE) && (CONFIGURED === 'api' || (!import.meta.env.DEV && CONFIGURED !== 'mock'))

export interface ApiUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: User['role']
  businessName: string | null
  mustChangePassword: boolean
  emailVerified: boolean
  phoneVerified: boolean
}

export const toUser = (u: ApiUser): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  ...(u.phone ? { phone: u.phone } : {}),
  ...(u.businessName ? { businessName: u.businessName } : {}),
  mustChangePassword: u.mustChangePassword,
  emailVerified: u.emailVerified,
  phoneVerified: u.phoneVerified,
})

/** One plain-language sentence for whatever went wrong, including field-level problems. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const fields = Object.values(e.fields)
    return fields.length ? fields.join(' ') : e.message
  }
  return 'Something went wrong. Please try again.'
}

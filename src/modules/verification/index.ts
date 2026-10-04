import { httpVerification, mockVerification } from './providers'
import type { VerificationProvider } from './types'

export * from './types'
export { normaliseTarget } from './providers'

/**
 * VITE_VERIFICATION_PROVIDER = mock | http
 * Default: mock in development, http in production (needs VITE_API_URL).
 * A mock can never run in a production build, so nobody can "verify" with a
 * code the browser invented.
 */
const CONFIGURED = (import.meta.env.VITE_VERIFICATION_PROVIDER as string | undefined)?.trim().toLowerCase()

export function getVerificationProvider(): VerificationProvider | null {
  const id = CONFIGURED || (import.meta.env.DEV ? 'mock' : 'http')
  if (id === 'mock') return import.meta.env.DEV ? mockVerification : null
  return httpVerification
}

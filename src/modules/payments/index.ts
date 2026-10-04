import { createHttpProvider } from './providers/http'
import { mockProvider } from './providers/mock'
import type { PaymentProvider } from './types'

export * from './types'
export { mockGatewayRespond } from './providers/mock'

/**
 * Pick the provider with VITE_PAYMENT_PROVIDER in .env:
 *
 *   mock         → development only
 *   paystack     → backend uses Paystack
 *   flutterwave  → backend uses Flutterwave
 *   anything else→ also works (e.g. monnify); the backend decides
 */
const CONFIGURED = (import.meta.env.VITE_PAYMENT_PROVIDER as string | undefined)?.trim().toLowerCase()

const LABELS: Record<string, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
}

export type ProviderState =
  | { ok: true; provider: PaymentProvider }
  | { ok: false; reason: string }

export function resolvePaymentProvider(): ProviderState {
  // Development defaults to the fake gateway so the flow can be tried.
  const id = CONFIGURED || (import.meta.env.DEV ? 'mock' : '')

  if (!id) {
    return { ok: false, reason: 'Online payment isn’t available yet. Please check back soon.' }
  }

  if (id === 'mock') {
    // A fake gateway must never run for real customers.
    return import.meta.env.DEV
      ? { ok: true, provider: mockProvider }
      : { ok: false, reason: 'Online payment isn’t available yet. Please check back soon.' }
  }

  return { ok: true, provider: createHttpProvider(id, LABELS[id] ?? id) }
}

import { API_HEADERS } from '@/lib/api'
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentSession,
  PaymentStatus,
  PaymentVerification,
  ProviderId,
  RefundResult,
} from '../types'

/**
 * Talks to Karta's own backend, which holds the secret keys and calls the
 * chosen provider. The same adapter works for Paystack, Flutterwave,
 * Monnify, etc., because only the backend knows the difference.
 *
 * Backend contract (to implement in the NestJS API):
 *
 *   POST {API}/orders
 *     body:  { lines: [{ listingId, qty }], ship }  ← server prices it
 *     reply: { id, totalKobo, ... }
 *
 *   POST {API}/payments/initialize
 *     body:  { orderId, returnUrl }              ← NOT the amount
 *     reply: { reference, checkoutUrl }          ← server-computed amount
 *
 *   GET  {API}/payments/verify/:reference
 *     reply: { status: 'pending'|'paid'|'failed'|'abandoned', paidAmountKobo }
 *
 *   POST {API}/payments/refund
 *     body:  { reference, amountKobo, note }
 *     reply: { status: 'completed'|'pending'|'failed', reference, error }
 *
 *   POST {API}/payments/webhook/:provider        ← provider → server, signed
 */
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new Error('Payments are not configured yet (VITE_API_URL is missing).')

  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...API_HEADERS, ...(init?.headers ?? {}) },
  })

  if (!res.ok) {
    // Show the server's own plain-language message when it gave one (e.g. "Only 1 left").
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'We couldn’t reach the payment service. Please try again.')
  }
  return (await res.json()) as T
}

export function createHttpProvider(id: ProviderId, label: string): PaymentProvider {
  return {
    id,
    label,

    async initialize(req: PaymentRequest): Promise<PaymentSession> {
      // The server owns the order and its price. Create it there first, then pay for THAT order.
      let serverOrderId = req.orderId
      if (req.lines && req.ship) {
        const created = await call<{ id: string; totalKobo: number }>('/orders', {
          method: 'POST',
          body: JSON.stringify({ lines: req.lines, ship: req.ship }),
        })
        // Never charge an amount different from the one the customer was shown.
        if (created.totalKobo !== req.amountKobo) {
          throw new Error('Some prices or fees have changed since you added these items. Please review your cart and try again.')
        }
        serverOrderId = created.id
      }

      const data = await call<{ reference: string; checkoutUrl: string }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ orderId: serverOrderId, returnUrl: req.returnUrl }),
      })

      return { provider: id, reference: data.reference, mode: 'redirect', checkoutUrl: data.checkoutUrl }
    },

    async verify(reference: string): Promise<PaymentVerification> {
      const data = await call<{ status: PaymentStatus; paidAmountKobo?: number }>(
        `/payments/verify/${encodeURIComponent(reference)}`,
      )
      return data
    },

    async refund(reference: string, amountKobo: number, note: string): Promise<RefundResult> {
      try {
        return await call<RefundResult>('/payments/refund', {
          method: 'POST',
          body: JSON.stringify({ reference, amountKobo, note }),
        })
      } catch (e) {
        return { status: 'failed', error: e instanceof Error ? e.message : 'We couldn’t reach the payment service.' }
      }
    },
  }
}

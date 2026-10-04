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
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (!res.ok) throw new Error('We couldn’t reach the payment service. Please try again.')
  return (await res.json()) as T
}

export function createHttpProvider(id: ProviderId, label: string): PaymentProvider {
  return {
    id,
    label,

    async initialize(req: PaymentRequest): Promise<PaymentSession> {
      const data = await call<{ reference: string; checkoutUrl: string }>('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ orderId: req.orderId, returnUrl: req.returnUrl }),
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

/**
 * Paystack, behind a small interface so tests can swap in a fake and no other
 * file ever imports fetch. The secret key is read once at startup and never
 * logged, returned to a client, or put in an error message.
 */
export interface PaystackInit { authorizationUrl: string; reference: string }
export interface PaystackVerify { status: 'success' | 'failed' | 'abandoned' | 'pending'; amountKobo: number; currency: string; reference: string }
export interface PaystackRefund { status: 'pending' | 'completed' | 'failed'; reference?: string }

export interface PaystackClient {
  initialize(i: { email: string; amountKobo: number; reference: string; callbackUrl: string }): Promise<PaystackInit>
  verify(reference: string): Promise<PaystackVerify>
  refund(i: { reference: string; amountKobo: number; note: string }): Promise<PaystackRefund>
}

export class PaystackError extends Error {}

export function createPaystackClient(secretKey: string, baseUrl = 'https://api.paystack.co'): PaystackClient {
  async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
    let res: Response
    try {
      res = await fetch(baseUrl + path, {
        method: init?.method ?? 'GET',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new PaystackError('Paystack could not be reached.')
    }
    const json = (await res.json().catch(() => null)) as { status?: boolean; data?: T; message?: string } | null
    if (!res.ok || !json?.status) throw new PaystackError(`Paystack rejected the request (${res.status}).`)
    return json.data as T
  }

  return {
    async initialize({ email, amountKobo, reference, callbackUrl }) {
      const d = await call<{ authorization_url: string; reference: string }>('/transaction/initialize', {
        method: 'POST', body: { email, amount: amountKobo, currency: 'NGN', reference, callback_url: callbackUrl },
      })
      return { authorizationUrl: d.authorization_url, reference: d.reference }
    },
    async verify(reference) {
      const d = await call<{ status: string; amount: number; currency: string; reference: string }>(`/transaction/verify/${encodeURIComponent(reference)}`)
      const status = d.status === 'success' ? 'success' : d.status === 'failed' || d.status === 'reversed' ? 'failed' : d.status === 'abandoned' ? 'abandoned' : 'pending'
      return { status, amountKobo: d.amount, currency: d.currency, reference: d.reference }
    },
    async refund({ reference, amountKobo, note }) {
      const d = await call<{ status: string }>('/refund', { method: 'POST', body: { transaction: reference, amount: amountKobo, customer_note: note, merchant_note: note } })
      return { status: d.status === 'processed' ? 'completed' : d.status === 'failed' ? 'failed' : 'pending', reference }
    },
  }
}

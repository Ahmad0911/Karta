/* -------------------------------------------------------------------------- */
/* Karta payments — provider-agnostic contract                                */
/* -------------------------------------------------------------------------- */
/**
 * The storefront never talks to Paystack, Flutterwave, Monnify, etc. directly.
 * It talks to a `PaymentProvider`, which talks to YOUR API, which talks to
 * whichever third party you choose. Switching provider is then a backend
 * and config change; no checkout screen changes.
 *
 * Non-negotiable rules (they apply to every provider):
 *  1. Secret keys live only on the server.
 *  2. The SERVER computes the amount from its own prices. The amount the
 *     browser sends is ignored or cross-checked.
 *  3. A payment is "paid" only when the server has verified it with the
 *     provider (verify call / signed webhook). A redirect back to the
 *     site proves nothing.
 *  4. Verification is idempotent: processing the same reference twice must
 *     not create two orders.
 */

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'abandoned'

export type ProviderId = 'mock' | 'paystack' | 'flutterwave' | (string & {})

export interface PaymentRequest {
  orderId: string
  orderNumber: string
  /** Minor units (kobo). 1 naira = 100 kobo. Integers only. */
  amountKobo: number
  currency: 'NGN'
  customerEmail: string
  customerName: string
  /** Where the provider sends the customer afterwards. */
  returnUrl: string
}

export interface PaymentSession {
  provider: ProviderId
  reference: string
  /**
   * redirect → send the browser to `checkoutUrl` (hosted page)
   * inline   → the app shows its own gateway UI (mock only)
   */
  mode: 'redirect' | 'inline'
  checkoutUrl?: string
}

export interface PaymentVerification {
  status: PaymentStatus
  paidAmountKobo?: number
}

export interface RefundResult {
  status: 'completed' | 'pending' | 'failed'
  reference?: string
  error?: string
}

export interface PaymentProvider {
  id: ProviderId
  label: string
  initialize(req: PaymentRequest): Promise<PaymentSession>
  verify(reference: string): Promise<PaymentVerification>
  /** Sends money back to the customer. Amount in kobo. */
  refund(reference: string, amountKobo: number, note: string): Promise<RefundResult>
}

export const toKobo = (naira: number) => Math.round(naira * 100)

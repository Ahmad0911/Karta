import type {
  RefundResult,
  PaymentProvider,
  PaymentRequest,
  PaymentSession,
  PaymentStatus,
  PaymentVerification,
} from '../types'

/**
 * DEV-ONLY fake gateway. It is never used in a production build
 * (see ../index.ts), so it can't be abused to "pay" with nothing.
 */

const sessions = new Map<string, { amountKobo: number; status: PaymentStatus; refundedKobo: number }>()

export const mockProvider: PaymentProvider = {
  id: 'mock',
  label: 'Test gateway (development only)',

  async initialize(req: PaymentRequest): Promise<PaymentSession> {
    const reference = `MOCK-${req.orderNumber}-${Date.now().toString(36)}`
    sessions.set(reference, { amountKobo: req.amountKobo, status: 'pending', refundedKobo: 0 })
    return { provider: 'mock', reference, mode: 'inline' }
  },

  async verify(reference: string): Promise<PaymentVerification> {
    const s = sessions.get(reference)
    if (!s) return { status: 'failed' }
    return { status: s.status, paidAmountKobo: s.status === 'paid' ? s.amountKobo : undefined }
  },

  async refund(reference, amountKobo): Promise<RefundResult> {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) return { status: 'failed', error: 'Invalid amount.' }

    // This mock's memory resets on every page reload, so a payment made earlier
    // is no longer in `sessions`. The orders store still caps refunds at the
    // amount paid, so accept our own references.
    const s = sessions.get(reference)
    if (!s && reference.startsWith('MOCK-')) return { status: 'completed', reference: `RF-${reference}-${Date.now().toString(36)}` }
    if (!s || s.status !== 'paid') return { status: 'failed', error: 'That payment can’t be refunded.' }
    // Same guard a real provider applies: never refund more than was collected.
    if (s.refundedKobo + amountKobo > s.amountKobo) return { status: 'failed', error: 'Refund is more than the amount paid.' }

    s.refundedKobo += amountKobo
    return { status: 'completed', reference: `RF-${reference}-${s.refundedKobo}` }
  },
}

/** Called by the test gateway dialog to simulate what the bank/provider does. */
export function mockGatewayRespond(reference: string, outcome: 'paid' | 'failed' | 'abandoned') {
  const s = sessions.get(reference)
  if (s && s.status === 'pending') s.status = outcome
}

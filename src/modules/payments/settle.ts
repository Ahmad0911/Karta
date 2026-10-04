import { useOrdersStore } from '@/modules/orders/orders.store'
import type { CustomerOrder } from '@/modules/orders/types'
import type { PaymentProvider } from './types'

export type SettleResult =
  | { outcome: 'paid'; order: CustomerOrder }
  | { outcome: 'failed' | 'abandoned' | 'pending'; message: string }
  | { outcome: 'error'; message: string }

/**
 * The ONLY place an order becomes "paid".
 *
 * Asks the provider (through our backend) for the verified status, never
 * trusts the browser redirect, and checks the full amount. Safe to call more
 * than once for the same reference.
 */
export async function settlePayment(
  provider: PaymentProvider,
  orderId: string,
  reference: string,
): Promise<SettleResult> {
  const orders = useOrdersStore.getState()

  try {
    const v = await provider.verify(reference)

    if (v.status === 'paid') {
      const r = orders.markPaid(orderId, {
        provider: provider.id,
        reference,
        paidAmountKobo: v.paidAmountKobo,
      })
      return r.ok ? { outcome: 'paid', order: r.data } : { outcome: 'error', message: r.error }
    }

    if (v.status === 'pending') {
      return {
        outcome: 'pending',
        message: 'We haven’t received confirmation of your payment yet. If you were charged, your order will update automatically. Please don’t pay again.',
      }
    }

    orders.markPaymentFailed(orderId, v.status)
    return {
      outcome: v.status,
      message:
        v.status === 'abandoned'
          ? 'Payment was cancelled. You haven’t been charged.'
          : 'Your payment didn’t go through. You haven’t been charged. Please try again or use another method.',
    }
  } catch (e) {
    return {
      outcome: 'error',
      message: e instanceof Error ? e.message : 'We couldn’t confirm your payment. Please try again.',
    }
  }
}

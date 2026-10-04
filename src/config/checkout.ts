import { NIGERIAN_STATES } from '@/modules/vendors/data/reference'

/**
 * Delivery pricing shown at checkout.
 *
 * CONFIRM with logistics before launch. The server must recompute every
 * amount from its own price list; the browser's numbers are for display only.
 */
export const DELIVERY_FEES: Record<string, number> = {
  'FCT (Abuja)': 15000,
  Nasarawa: 22000,
  Niger: 25000,
  Kaduna: 30000,
  Kogi: 30000,
  Lagos: 40000,
  Oyo: 40000,
  Ogun: 40000,
  Rivers: 45000,
  Enugu: 45000,
  Kano: 45000,
}

export const DEFAULT_DELIVERY_FEE = 50000

export const deliveryFeeFor = (state: string) =>
  DELIVERY_FEES[state] ?? DEFAULT_DELIVERY_FEE

export const CHECKOUT_STATES = NIGERIAN_STATES

/** Karta's own logistics partner in this prototype. */
export const DEFAULT_COURIER = { id: 'karta-logistics', name: 'Karta Delivery' } as const

/** Business rules the SERVER owns. CONFIRM the numbers with the business before launch. */
export const POLICY = {
  commissionRate: 0.1,
  maxImages: 4,
  minPriceKobo: 100_000,
  draftPriceKobo: 100,
} as const

export const commissionKobo = (subtotalKobo: number) => Math.floor(subtotalKobo * POLICY.commissionRate)

/** Vendors move an order through these; anything else is not theirs to change. */
export const VENDOR_NEXT = { new: 'confirmed', confirmed: 'packing', packing: 'ready_for_pickup' } as const
export const VENDOR_CAN_DECLINE = ['new', 'confirmed']

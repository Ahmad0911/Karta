/**
 * Vendor business rules in one place.
 *
 * CONFIRM with the business before launch. The server must own these numbers
 * (BRD §20.3); the client only uses them to display estimates.
 */
export const VENDOR_POLICY = {
  /** Karta commission on the item subtotal. */
  commissionRate: 0.1,

  /** Stock at or below this shows a "low stock" warning. */
  lowStockThreshold: 3,

  /** Max photos per listing. */
  maxImages: 4,

  /** Payout runs on this weekday (0 = Sunday … 5 = Friday). */
  payoutWeekday: 5,

  /** Vendors must confirm a new order within this many hours. */
  confirmWithinHours: 24,
} as const

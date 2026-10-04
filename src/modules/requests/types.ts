/**
 * open      → vendors can see it and make an offer
 * claimed   → one vendor made an offer; hidden from every other vendor
 * accepted  → customer accepted; a private listing exists for them to buy
 * ordered   → the customer paid
 * closed    → cancelled, expired or declined for good
 * removed   → taken down by Karta staff
 */
export type RequestStatus = 'open' | 'claimed' | 'accepted' | 'ordered' | 'closed' | 'removed'

export interface RequestOffer {
  vendorEmail: string
  vendorId: string
  vendorName: string
  /** Naira, whole numbers. */
  price: number
  /** Days to make it, before delivery. */
  days: number
  note: string
  at: string
  /** The customer must answer before this, or the request reopens. */
  expiresAt: string
  /** Set once accepted: the private listing the customer can buy. */
  listingId?: string
}

export interface RequestEvent {
  id: string
  at: string
  by: 'customer' | 'vendor' | 'admin' | 'system'
  action: string
  note?: string
}

export interface CustomRequest {
  id: string
  number: string
  customerEmail: string
  /** "Chidinma O." Vendors never see an email or phone. */
  customerLabel: string
  city: string
  state: string

  title: string
  description: string
  categoryId?: string
  room?: string
  styles: string[]
  dimensions?: string
  budgetMin?: number
  budgetMax?: number
  /** Customer would like it within this many days. Undefined = flexible. */
  neededWithinDays?: number
  images: string[]

  status: RequestStatus
  offer?: RequestOffer
  /** Vendors whose offer was declined, withdrawn or timed out. They can't claim again. */
  declinedBy: string[]
  removedReason?: string

  events: RequestEvent[]
  createdAt: string
  updatedAt: string
  /** Open requests lapse after 30 days. */
  expiresAt: string
}

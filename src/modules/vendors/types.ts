import type { ProductColor } from '@/types'

/* -------------------------------------------------------------------------- */
/* Karta — Vendor domain (BRD §9, §10, §13)                                   */
/* -------------------------------------------------------------------------- */

/* ------------------------------ Onboarding -------------------------------- */

/**
 * draft              → vendor is still filling the application
 * under_review       → submitted, waiting for the Karta team
 * changes_requested  → reviewer asked for corrections (see reviewNote)
 * approved           → storefront may go live
 *
 * The server decides every status after `draft`. The client only requests
 * "submit"; it never approves itself outside the DEV mock controls.
 */
export type VendorStatus =
  | 'draft'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type VerificationAction =
  | 'submitted'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'suspended'
  | 'reinstated'

/** Append-only audit trail of every decision about a vendor. */
export interface VerificationEntry {
  id: string
  at: string
  /** Admin email, or the vendor's own email for "submitted". */
  by: string
  action: VerificationAction
  note?: string
}

export type BusinessType = 'individual' | 'registered'

export type DocumentKind =
  | 'government_id'
  | 'business_registration'
  | 'proof_of_address'
  | 'workshop_photo'

/** Metadata only. The real file goes to object storage via the API. */
export interface VendorDocument {
  id: string
  kind: DocumentKind
  fileName: string
  sizeKb: number
  uploadedAt: string
}

export interface VendorProfile {
  status: VendorStatus
  reviewNote?: string
  submittedAt?: string
  approvedAt?: string

  /** 0–100, computed by the server (BRD §11). */
  trustScore: number

  /** Every submission and admin decision, oldest first. */
  verificationLog?: VerificationEntry[]

  /** Wizard progress, 0-based. */
  onboardingStep: number

  business: {
    name: string
    type: BusinessType
    /** CAC registration number, required when type is "registered". */
    rcNumber: string
    description: string
    categoryIds: string[]
    address: string
    city: string
    state: string
  }

  contact: {
    person: string
    phone: string
    whatsapp: string
    email: string
  }

  documents: VendorDocument[]

  payout: {
    bankName: string
    accountNumber: string
    accountName: string
  }

  agreedToTerms: boolean
}

/* -------------------------------- Listings -------------------------------- */

/**
 * draft     → private, still being written
 * in_review → submitted for Karta moderation
 * live      → visible in the storefront
 * paused    → vendor hid it (kept, not sold)
 */
export type ListingStatus = 'draft' | 'in_review' | 'live' | 'paused'

export interface VendorListing {
  id: string
  sku: string
  name: string
  categoryId: string
  room: string
  description: string
  material: string
  dimensions: string
  colors: ProductColor[]

  /** Naira, whole numbers. */
  price: number
  originalPrice?: number

  stock: number
  deliveryMinDays: number
  deliveryMaxDays: number
  assemblyAvailable: boolean

  /** Data URLs in the mock. Replace with CDN URLs from the API. */
  images: string[]

  status: ListingStatus
  /**
   * Made for ONE customer from a custom request. Only that customer can see or
   * buy it. Can't be edited by the vendor once the customer accepted the price.
   */
  custom?: { requestId: string; customerEmail: string }
  /** Moderator feedback when a listing is sent back. */
  moderationNote?: string

  createdAt: string
  updatedAt: string
}

/* --------------------------------- Orders --------------------------------- */

/**
 * Vendor controls: new → confirmed → packing → ready_for_pickup
 * Logistics controls: with_logistics → delivered
 */
export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'packing'
  | 'ready_for_pickup'
  | 'with_logistics'
  | 'delivered'
  | 'cancelled'

export interface OrderLine {
  listingId: string
  name: string
  qty: number
  unitPrice: number
  assembly: boolean
}

export interface OrderEvent {
  status: OrderStatus
  at: string
  note?: string
}

export interface VendorOrder {
  id: string
  number: string
  /** First name + initial only. Full customer data stays server-side. */
  customerLabel: string
  city: string
  state: string
  lines: OrderLine[]
  subtotal: number
  /** Karta commission in naira at the time of the order. */
  commission: number
  netEarning: number
  status: OrderStatus
  placedAt: string
  deliveredAt?: string
  cancelReason?: string
  /** Set once the order is included in a payout. */
  payoutId?: string
  /** Item value returned to the customer so far. */
  refundedItems?: number
  /** Money to recover from the vendor because a refund came after the payout. */
  clawback?: number
  events: OrderEvent[]
}

/* -------------------------------- Payouts --------------------------------- */

export interface VendorPayout {
  id: string
  reference: string
  amount: number
  orderIds: string[]
  paidAt: string
  bankLabel: string
}

/* ------------------------------- Workspace -------------------------------- */

export interface VendorWorkspace {
  profile: VendorProfile
  listings: VendorListing[]
  orders: VendorOrder[]
  payouts: VendorPayout[]
}

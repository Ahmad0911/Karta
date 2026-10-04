
/* -------------------------------------------------------------------------- */
/* Karta — Core Domain Types                                                  */
/* -------------------------------------------------------------------------- */
/**
 * Shared application-level domain models.
 *
 * Keep cross-cutting entities here so feature modules can depend on a single
 * source of truth.
 *
 * BRD references:
 * - Roles: §8
 * - Trust categories: §11.2
 */

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

export type Role =
  | 'customer'
  | 'vendor'
  | 'logistics'
  | 'support'
  | 'operations'
  | 'finance'
  | 'admin'
  | 'super_admin'

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: Role
  /** Set for vendor accounts at registration. */
  businessName?: string
  /** Set on accounts created by staff with a temporary password. */
  mustChangePassword?: boolean
  /** Set only after the owner entered a code sent to this email / phone. */
  emailVerified?: boolean
  phoneVerified?: boolean
}

/* -------------------------------------------------------------------------- */
/* Trust                                                                      */
/* -------------------------------------------------------------------------- */

export type TrustCategory =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'watchlist'
  | 'high-risk'

/**
 * Converts a numerical trust score into the corresponding BRD trust category.
 *
 * Expected score range: 0–100.
 *
 * The function deliberately clamps invalid values so UI and API data cannot
 * accidentally produce an undefined trust category.
 */
export function trustCategoryFromScore(
  score: number,
): TrustCategory {
  const normalizedScore = Math.min(
    100,
    Math.max(0, score),
  )

  if (normalizedScore >= 85) return 'excellent'
  if (normalizedScore >= 70) return 'good'
  if (normalizedScore >= 55) return 'fair'
  if (normalizedScore >= 40) return 'watchlist'

  return 'high-risk'
}

/* -------------------------------------------------------------------------- */
/* Vendor                                                                     */
/* -------------------------------------------------------------------------- */

export interface Vendor {
  id: string
  name: string
  trustScore: number
}

/* -------------------------------------------------------------------------- */
/* Category                                                                   */
/* -------------------------------------------------------------------------- */

export interface Category {
  id: string
  name: string
}

/* -------------------------------------------------------------------------- */
/* Product                                                                    */
/* -------------------------------------------------------------------------- */

export type ProductTag =
  | 'Bestseller'
  | 'New Arrival'
  | 'Hot Deal'
  | 'Featured'
  | 'Premium'

export interface ProductColor {
  name: string
  hex: string
}

export type DeliveryEstimate = [
  minimumDays: number,
  maximumDays: number,
]

export interface Product {
  /** Unique product identifier. */
  id: string

  /** Customer-facing product name. */
  name: string

  /** Product category identifier. */
  categoryId: string

  /** Room identifier from data/rooms.ts. */
  room: string

  /** Current selling price in the application's base currency. */
  price: number

  /** Previous price when the product is discounted. */
  originalPrice?: number

  /** Vendor responsible for the product listing. */
  vendor: Vendor

  /** Average customer rating. */
  rating: number

  /** Number of customer reviews contributing to the rating. */
  reviewCount: number

  /** Primary material or material description. */
  material: string

  /** Customer-facing dimensions string. */
  dimensions: string

  /** Available product finishes / colour variants. */
  colors?: ProductColor[]

  /** Estimated delivery window, represented as [minimum, maximum] days. */
  deliveryEstimateDays: DeliveryEstimate

  /** Whether professional assembly can be selected. */
  assemblyAvailable: boolean

  /** Whether the product is currently available for purchase. */
  inStock: boolean

  /** Optional merchandising label displayed across the storefront. */
  tag?: ProductTag

  /**
   * Tailwind gradient classes used as the visual fallback until a real
   * product image is available.
   */
  swatch: string

  /**
   * Optional image path under /public.
   *
   * Example:
   * /images/products/p1.jpg
   */
  image?: string
}

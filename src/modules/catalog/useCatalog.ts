import { useMemo } from 'react'

import { products as seedProducts } from '@/data/products'
import type { Product, Vendor } from '@/types'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import { summarize } from '@/modules/reviews/lib'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import { useAuthStore } from '@/store/auth.store'
import { vendorIdFor } from './vendorId'
import type { VendorListing, VendorProfile } from '@/modules/vendors/types'

/* -------------------------------------------------------------------------- */
/* Storefront catalogue                                                       */
/* -------------------------------------------------------------------------- */
/**
 * The single place that decides what customers can buy.
 *
 * RULE: a vendor listing is visible ONLY when
 *   1. its own status is `live` (passed Karta moderation), AND
 *   2. its vendor's status is `approved` (verified, not suspended/rejected).
 *
 * Suspending a vendor therefore hides their whole shop instantly. The real
 * API must apply the same rule in its queries; never rely on the client.
 */

export { vendorIdFor }

const FALLBACK_SWATCH = 'from-[#d8cbb5] to-[#a89373]'

export function isSellable(profile: VendorProfile, listing: VendorListing) {
  return profile.status === 'approved' && listing.status === 'live'
}

function toProduct(
  email: string,
  profile: VendorProfile,
  l: VendorListing,
): Product {
  const vendor: Vendor = {
    id: vendorIdFor(email),
    name: profile.business.name,
    trustScore: profile.trustScore,
  }

  return {
    id: l.id,
    name: l.name,
    categoryId: l.categoryId,
    room: l.room,
    price: l.price,
    originalPrice: l.originalPrice,
    vendor,
    rating: 0,
    reviewCount: 0,
    material: l.material,
    dimensions: l.dimensions,
    colors: l.colors.length ? l.colors : undefined,
    deliveryEstimateDays: [l.deliveryMinDays, l.deliveryMaxDays],
    assemblyAvailable: l.assemblyAvailable,
    inStock: l.stock > 0,
    swatch: FALLBACK_SWATCH,
    image: l.images[0],
  }
}

export interface Catalog {
  products: Product[]
  getProduct: (id: string) => Product | undefined
  /** Email of the vendor account that owns a platform listing (not seed data). */
  ownerEmail: (productId: string) => string | undefined
}

export function useCatalog(): Catalog {
  const byEmail = useVendorStore((s) => s.byEmail)
  const reviews = useReviewsStore((s) => s.reviews)
  const viewer = useAuthStore((s) => s.user?.email.trim().toLowerCase())

  return useMemo(() => {
    // Real, purchase-verified vendor reviews replace any placeholder numbers.
    const stats = new Map<string, { average: number; count: number }>()
    const statsFor = (vendorId: string) => {
      let v = stats.get(vendorId)
      if (!v) {
        const sum = summarize(reviews.filter((r) => r.target === 'vendor' && r.targetId === vendorId))
        v = { average: sum.average, count: sum.count }
        stats.set(vendorId, v)
      }
      return v
    }
    const withReviews = (p: Product): Product => {
      const v = statsFor(p.vendor.id)
      return { ...p, rating: Math.round(v.average * 10) / 10, reviewCount: v.count }
    }

    const owners = new Map<string, string>()
    const privateIds = new Set<string>()

    const live = Object.entries(byEmail).flatMap(([email, w]) =>
      w.listings
        .filter((l) => isSellable(w.profile, l))
        // A piece made for one customer is invisible to everyone else.
        .filter((l) => !l.custom || l.custom.customerEmail === viewer)
        .map((l) => {
          owners.set(l.id, email)
          if (l.custom) privateIds.add(l.id)
          return toProduct(email, w.profile, l)
        }),
    )

    const all = [...seedProducts, ...live].map(withReviews)
    const index = new Map(all.map((p) => [p.id, p]))
    // Browsing never lists private pieces; they're reached from the customer's request page.
    const products = all.filter((p) => !privateIds.has(p.id))

    return {
      products,
      getProduct: (id: string) => index.get(id),
      ownerEmail: (id: string) => owners.get(id),
    }
  }, [byEmail, reviews, viewer])
}

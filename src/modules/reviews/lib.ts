import type { Review } from './types'

/* -------------------------------------------------------------------------- */
/* Rating maths + recommendations                                             */
/* -------------------------------------------------------------------------- */

export interface RatingSummary {
  count: number
  average: number
  /** index 0 = 1 star … index 4 = 5 stars */
  distribution: [number, number, number, number, number]
}

export function summarize(reviews: Review[]): RatingSummary {
  const published = reviews.filter((r) => r.status === 'published')
  const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0]
  let sum = 0

  for (const r of published) {
    distribution[r.rating - 1] += 1
    sum += r.rating
  }

  return {
    count: published.length,
    average: published.length ? sum / published.length : 0,
    distribution,
  }
}

/**
 * Bayesian average: pulls small samples toward a neutral prior so a vendor
 * with one 5-star review doesn't outrank one with 40 reviews averaging 4.8.
 */
const PRIOR_MEAN = 3.8
const PRIOR_WEIGHT = 5

export const bayesian = (average: number, count: number) =>
  (PRIOR_WEIGHT * PRIOR_MEAN + average * count) / (PRIOR_WEIGHT + count)

/* ----------------------------- Recommendations ---------------------------- */

export const RECOMMEND_RULES = {
  /** Must have at least this many published, purchase-verified reviews. */
  minReviews: 3,
  /** Bayesian-adjusted rating needed. */
  minRating: 4.2,
  /** Karta's own trust score (BRD §11) must also be healthy. */
  minTrust: 70,
} as const

export interface VendorRef {
  id: string
  name: string
  trustScore: number
}

export interface Recommendation {
  vendor: VendorRef
  summary: RatingSummary
  adjusted: number
  /** 0–1, used only for ordering. */
  score: number
  recommended: boolean
  /** Plain-language reasons shown to customers. */
  reasons: string[]
}

export function evaluateVendor(vendor: VendorRef, reviews: Review[]): Recommendation {
  const summary = summarize(reviews.filter((r) => r.target === 'vendor' && r.targetId === vendor.id))
  const adjusted = bayesian(summary.average, summary.count)

  // Rating carries more weight than trust, but both must be healthy.
  const score = 0.6 * (adjusted / 5) + 0.4 * (vendor.trustScore / 100)

  const recommended =
    summary.count >= RECOMMEND_RULES.minReviews &&
    adjusted >= RECOMMEND_RULES.minRating &&
    vendor.trustScore >= RECOMMEND_RULES.minTrust

  const reasons: string[] = []
  if (summary.count > 0) {
    reasons.push(`${summary.average.toFixed(1)} average from ${summary.count} verified review${summary.count === 1 ? '' : 's'}`)
  }
  reasons.push(`Trust score ${vendor.trustScore}/100`)

  return { vendor, summary, adjusted, score, recommended, reasons }
}

export function recommendVendors(vendors: VendorRef[], reviews: Review[]): Recommendation[] {
  return vendors
    .map((v) => evaluateVendor(v, reviews))
    .sort((a, b) => b.score - a.score)
}

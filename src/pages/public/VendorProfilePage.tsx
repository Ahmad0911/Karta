import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, MapPin } from 'lucide-react'

import ProductCard from '@/modules/catalog/components/ProductCard'
import { useCatalog } from '@/modules/catalog/useCatalog'
import { useVendorDirectory } from '@/modules/catalog/useVendorDirectory'
import TrustBadge from '@/modules/vendors/components/TrustBadge'
import { Stars } from '@/modules/reviews/components/Stars'
import ReviewsPanel from '@/modules/reviews/components/ReviewsPanel'
import { RECOMMEND_RULES, evaluateVendor, recommendVendors } from '@/modules/reviews/lib'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export default function VendorProfilePage() {
  const { id = '' } = useParams()
  const directory = useVendorDirectory()
  const { products } = useCatalog()
  const reviews = useReviewsStore((s) => s.reviews)

  const vendor = directory.find((v) => v.id === id)
  useDocumentTitle(vendor ? vendor.name : 'Vendor not found')

  if (!vendor) {
    return (
      <main className="container-x py-28 text-center">
        <h1 className="font-display text-4xl tracking-[-0.03em]">We couldn’t find that vendor.</h1>
        <p className="mt-3 text-sm text-ink/55">They may no longer be on Karta.</p>
        <Link to="/shop" className="btn-dark mt-8 inline-flex">Back to the shop</Link>
      </main>
    )
  }

  const mine = products.filter((p) => p.vendor.id === vendor.id)
  const vendorReviews = reviews.filter((r) => r.target === 'vendor' && r.targetId === vendor.id)
  const ev = evaluateVendor(vendor, reviews)

  const others = recommendVendors(directory.filter((v) => v.id !== vendor.id), reviews)
    .filter((r) => r.recommended)
    .slice(0, 3)

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x space-y-14 py-12 sm:py-16">
        <header className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">Karta vendor</p>
          <h1 className="mt-3 font-display text-5xl font-medium leading-[1] tracking-[-0.045em] sm:text-6xl">{vendor.name}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <TrustBadge vendorName={vendor.name} score={vendor.trustScore} />
            {ev.summary.count > 0 ? (
              <span className="flex items-center gap-2 text-sm">
                <Stars value={ev.summary.average} />
                <strong>{ev.summary.average.toFixed(1)}</strong>
                <span className="text-ink/50">({ev.summary.count})</span>
              </span>
            ) : (
              <span className="text-sm text-ink/50">No reviews yet</span>
            )}
            {vendor.location && (
              <span className="flex items-center gap-1.5 text-sm text-ink/55"><MapPin aria-hidden="true" className="h-4 w-4" />{vendor.location}</span>
            )}
          </div>

          {ev.recommended && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#315d4b]/10 px-4 py-2 text-xs font-semibold text-[#265041]">
              <BadgeCheck aria-hidden="true" className="h-4 w-4" /> Recommended by Karta · {ev.reasons.join(' · ')}
            </p>
          )}

          {vendor.about && <p className="mt-6 text-sm leading-7 text-ink/65">{vendor.about}</p>}
        </header>

        <section aria-labelledby="pieces">
          <h2 id="pieces" className="font-display text-3xl tracking-[-0.03em]">Pieces by {vendor.name}</h2>
          {mine.length === 0 ? (
            <p className="mt-4 text-sm text-ink/55">No pieces available right now.</p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mine.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>

        <ReviewsPanel reviews={vendorReviews} heading="What customers say" />

        <p className="max-w-xl text-xs leading-5 text-ink/45">
          “Recommended” means at least {RECOMMEND_RULES.minReviews} verified reviews, a strong adjusted rating and a trust score of {RECOMMEND_RULES.minTrust}+. Vendors cannot buy or remove reviews.
        </p>

        {others.length > 0 && (
          <section aria-labelledby="also">
            <h2 id="also" className="font-display text-3xl tracking-[-0.03em]">Other recommended vendors</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {others.map((r) => (
                <li key={r.vendor.id}>
                  <Link to={`/vendors/${r.vendor.id}`} className="block rounded-2xl border border-ink/10 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:bg-white">
                    <p className="font-display text-xl tracking-[-0.02em]">{r.vendor.name}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm"><Stars value={r.summary.average} size={14} />{r.summary.average.toFixed(1)}</p>
                    <p className="mt-1 text-xs text-ink/50">{r.summary.count} verified reviews</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

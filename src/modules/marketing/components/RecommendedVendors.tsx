import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck } from 'lucide-react'

import { useVendorDirectory } from '@/modules/catalog/useVendorDirectory'
import { Stars } from '@/modules/reviews/components/Stars'
import { recommendVendors } from '@/modules/reviews/lib'
import { useReviewsStore } from '@/modules/reviews/reviews.store'

/**
 * Vendors that earned a recommendation through verified reviews.
 * Renders NOTHING until at least one vendor qualifies, so it never shows an
 * empty or fabricated section.
 */
export default function RecommendedVendors() {
  const directory = useVendorDirectory()
  const reviews = useReviewsStore((s) => s.reviews)

  const picks = recommendVendors(directory, reviews).filter((r) => r.recommended).slice(0, 3)
  if (picks.length === 0) return null

  return (
    <section aria-labelledby="recommended" className="border-t border-[#151b1c]/[0.06] bg-[#f8f6f1] py-20 sm:py-24">
      <div className="container-x">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">Recommended by Karta</p>
        <h2 id="recommended" className="mt-3 max-w-2xl font-display text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-5xl">
          Makers customers keep <span className="italic text-[#151b1c]/65">coming back to.</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[#151b1c]/60">
          Chosen from verified reviews and our own trust checks, never from payments.
        </p>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {picks.map((r) => (
            <li key={r.vendor.id}>
              <Link to={`/vendors/${r.vendor.id}`} className="group flex h-full flex-col rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-white/70 p-6 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_24px_60px_-35px_rgba(21,27,28,0.35)]">
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#315d4b]">
                    <BadgeCheck aria-hidden="true" className="h-4 w-4" /> Recommended
                  </span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#151b1c]/30 transition group-hover:text-[#8f7651]" />
                </div>
                <h3 className="mt-6 font-display text-2xl tracking-[-0.025em]">{r.vendor.name}</h3>
                <p className="mt-3 flex items-center gap-2 text-sm"><Stars value={r.summary.average} /> <strong>{r.summary.average.toFixed(1)}</strong></p>
                <p className="mt-auto pt-5 text-xs text-[#151b1c]/50">{r.reasons.join(' · ')}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

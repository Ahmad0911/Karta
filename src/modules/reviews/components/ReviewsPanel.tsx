import { BadgeCheck } from 'lucide-react'

import { formatDate } from '@/lib/date'
import { summarize } from '../lib'
import type { Review } from '../types'
import { Stars } from './Stars'

/** Rating summary + distribution + review list. Used on vendor pages. */
export default function ReviewsPanel({
  reviews,
  heading = 'Reviews',
  emptyText = 'No reviews yet. Reviews only come from customers whose orders were delivered.',
  renderActions,
}: {
  reviews: Review[]
  heading?: string
  emptyText?: string
  /** Optional per-review controls (reply, hide…). */
  renderActions?: (r: Review) => React.ReactNode
}) {
  const published = reviews
    .filter((r) => r.status === 'published')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const sum = summarize(published)

  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="font-display text-3xl tracking-[-0.03em]">
        {heading}
      </h2>

      {sum.count === 0 ? (
        <p className="mt-4 max-w-md text-sm leading-6 text-[#151b1c]/55">{emptyText}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
            <div>
              <p className="font-display text-6xl leading-none tracking-[-0.04em]">{sum.average.toFixed(1)}</p>
              <div className="mt-2">
                <Stars value={sum.average} size={18} />
              </div>
              <p className="mt-1 text-xs text-[#151b1c]/50">
                {sum.count} verified review{sum.count === 1 ? '' : 's'}
              </p>
            </div>

            <ul className="space-y-1.5" aria-label="Rating breakdown">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = sum.distribution[n - 1]
                return (
                  <li key={n} className="flex items-center gap-3 text-xs">
                    <span className="w-10 text-[#151b1c]/55">{n} star</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#151b1c]/[0.08]">
                      <span className="block h-full rounded-full bg-[#b08a4a]" style={{ width: `${(c / sum.count) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums text-[#151b1c]/45">{c}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <ul className="mt-8 divide-y divide-[#151b1c]/[0.08] border-y border-[#151b1c]/[0.08]">
            {published.map((r) => (
              <li key={r.id} className="py-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  <span className="text-sm font-semibold">{r.authorLabel}</span>
                  {!r.sample && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#315d4b]">
                      <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" /> Verified purchase
                    </span>
                  )}
                  <time dateTime={r.createdAt} className="text-xs text-[#151b1c]/40">
                    {formatDate(r.createdAt)}
                  </time>
                </div>

                <p className="mt-3 text-sm leading-7 text-[#151b1c]/75">{r.body}</p>

                {r.reply && (
                  <div className="mt-4 rounded-xl bg-[#151b1c]/[0.04] p-4 text-sm leading-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f7651]">
                      Response from the vendor · {formatDate(r.reply.at)}
                    </p>
                    <p className="mt-1.5 text-[#151b1c]/70">{r.reply.body}</p>
                  </div>
                )}

                {renderActions?.(r)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

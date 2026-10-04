import { MapPin } from 'lucide-react'

import { StatusPill } from '@/components/portal/ui'
import { categories } from '@/data/categories'
import { rooms } from '@/data/rooms'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { NEEDED_WITHIN } from './lib'
import type { CustomRequest, RequestStatus } from './types'

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: 'amber' | 'blue' | 'green' | 'neutral' | 'red' }> = {
  open: { label: 'Open to vendors', tone: 'amber' },
  claimed: { label: 'Offer received', tone: 'blue' },
  accepted: { label: 'Accepted · ready to buy', tone: 'green' },
  ordered: { label: 'Ordered', tone: 'green' },
  closed: { label: 'Closed', tone: 'neutral' },
  removed: { label: 'Removed', tone: 'red' },
}

export const budgetText = (r: CustomRequest) =>
  r.budgetMin && r.budgetMax ? `${formatNaira(r.budgetMin)} to ${formatNaira(r.budgetMax)}` : r.budgetMax ? `Up to ${formatNaira(r.budgetMax)}` : r.budgetMin ? `From ${formatNaira(r.budgetMin)}` : 'Open to quotes'

/** The request itself, as customers and vendors both see it. No contact details. */
export default function RequestSummary({ r, showStatus = true }: { r: CustomRequest; showStatus?: boolean }) {
  const needed = NEEDED_WITHIN.find((n) => n.days === r.neededWithinDays)?.label ?? 'Flexible'
  const category = categories.find((c) => c.id === r.categoryId)?.name
  const room = rooms.find((x) => x.id === r.room)?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f7651]">{r.number} · {r.customerLabel} · posted {formatDate(r.createdAt)}</p>
          <h3 className="mt-1 font-display text-2xl tracking-[-0.025em]">{r.title}</h3>
        </div>
        {showStatus && <StatusPill tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</StatusPill>}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-6 text-[#151b1c]/75">{r.description}</p>

      {r.images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {r.images.map((src, i) => <li key={i}><img src={src} alt={`Reference ${i + 1} for ${r.title}`} className="h-28 w-28 rounded-xl bg-[#eae5db] object-cover" /></li>)}
        </ul>
      )}

      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {([
          ['Budget', budgetText(r)],
          ['Needed', needed],
          ['Deliver to', `${r.city}, ${r.state}`],
          ['Style', r.styles.join(', ') || '—'],
          ...(category ? [['Category', category]] : []),
          ...(room ? [['Room', room]] : []),
          ...(r.dimensions ? [['Size', r.dimensions]] : []),
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex gap-3"><dt className="w-20 shrink-0 text-[#151b1c]/45">{k}</dt><dd className="min-w-0 break-words">{k === 'Deliver to' ? <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="h-3.5 w-3.5 text-[#8f7651]" />{v}</span> : v}</dd></div>
        ))}
      </dl>
    </div>
  )
}

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'

import { Card, EmptyState, PageHeader, StatusPill, primaryBtn } from '@/components/portal/ui'
import { timeAgo } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { REQUEST_STATUS } from '@/modules/requests/RequestSummary'
import { useRequestsStore } from '@/modules/requests/requests.store'
import { useAuthStore } from '@/store/auth.store'

export default function AccountRequestsPage() {
  useDocumentTitle('My requests')

  const me = useAuthStore((s) => s.user)!.email.trim().toLowerCase()
  const all = useRequestsStore((s) => s.requests)
  const sweep = useRequestsStore((s) => s.sweep)
  useEffect(() => sweep(), [sweep])

  const mine = all.filter((r) => r.customerEmail === me)

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-4xl space-y-8 py-12 sm:py-16">
        <PageHeader eyebrow="Made for you" title="My requests" description="Pieces you’ve asked vendors to make, and the offers you’ve received." actions={<Link to="/request" className={primaryBtn}><Plus className="h-4 w-4" /> New request</Link>} />
        <Card>
          {mine.length === 0 ? (
            <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No requests yet" body="Describe the piece you imagine, or upload a photo, and verified vendors can offer to make it." action={<Link to="/request" className={primaryBtn}>Request a piece</Link>} />
          ) : (
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {mine.map((r) => (
                <li key={r.id}>
                  <Link to={`/account/requests/${r.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6">
                    <span className="w-24 text-sm font-semibold">{r.number}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.title}</span><span className="block text-xs text-[#151b1c]/45">{r.offer ? `${r.offer.vendorName} · ${formatNaira(r.offer.price)} · ${r.offer.days} days · ` : ''}updated {timeAgo(r.updatedAt)}</span></span>
                    <StatusPill tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  )
}

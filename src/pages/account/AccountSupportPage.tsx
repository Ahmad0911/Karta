import { Link } from 'react-router-dom'
import { LifeBuoy, Plus } from 'lucide-react'

import { Card, EmptyState, PageHeader, StatusPill, primaryBtn } from '@/components/portal/ui'
import { timeAgo } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { CATEGORIES, STATUS, useSupportStore } from '@/modules/support/support.store'
import { useAuthStore } from '@/store/auth.store'

export default function AccountSupportPage() {
  useDocumentTitle('Support')

  const me = useAuthStore((s) => s.user)!.email.trim().toLowerCase()
  const all = useSupportStore((s) => s.tickets)
  const mine = all.filter((t) => t.requesterEmail === me)

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-4xl space-y-8 py-12 sm:py-16">
        <PageHeader eyebrow="Help" title="Support" description="Message the Karta team about an order, payment, delivery or anything else. We reply here and by email." actions={<Link to="/account/support/new" className={primaryBtn}><Plus className="h-4 w-4" /> New request</Link>} />

        <Card>
          {mine.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No requests yet" body="If you need a hand, start a request and a real person will reply." action={<Link to="/account/support/new" className={primaryBtn}>Contact support</Link>} />
          ) : (
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {mine.map((t) => (
                <li key={t.id}>
                  <Link to={`/account/support/${t.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6">
                    <span className="w-24 text-sm font-semibold">{t.number}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{t.subject}</span><span className="block text-xs text-[#151b1c]/45">{CATEGORIES[t.category]} · updated {timeAgo(t.updatedAt)}</span></span>
                    <StatusPill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</StatusPill>
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

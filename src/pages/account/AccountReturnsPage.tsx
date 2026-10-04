import { Link } from 'react-router-dom'
import { Undo2 } from 'lucide-react'

import { Card, CardHeader, EmptyState, PageHeader, StatusPill, secondaryBtn } from '@/components/portal/ui'
import { POLICY } from '@/config/company'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { REASONS, STATUS_META, canStartReturn, windowEnd } from '@/modules/returns/lib'
import { useReturnsStore } from '@/modules/returns/returns.store'
import { useAuthStore } from '@/store/auth.store'

export default function AccountReturnsPage() {
  useDocumentTitle('Returns & refunds')

  const user = useAuthStore((s) => s.user)!
  const email = user.email.trim().toLowerCase()
  const allReturns = useReturnsStore((s) => s.returns)
  const allOrders = useOrdersStore((s) => s.orders)

  const mine = allReturns.filter((r) => r.customerEmail === email)
  const eligible = allOrders.filter((o) => o.customerEmail === email && canStartReturn(o, allReturns))

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-4xl space-y-8 py-12 sm:py-16">
        <PageHeader eyebrow="Aftercare" title="Returns & refunds" description={`You can return an item within ${POLICY.returnWindowDays} days of delivery. Refunds take ${POLICY.refundProcessingDays} to reach your account.`} />

        <Card>
          <CardHeader title="Start a return" description="Delivered orders still inside the return window" />
          {eligible.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-[#151b1c]/50">No orders are eligible right now. Orders become returnable once delivered.</p>
          ) : (
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {eligible.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 sm:px-6">
                  <span className="min-w-0 flex-1 text-sm"><strong>{o.number}</strong> · {o.lines[0].name}{o.lines.length > 1 && ` + ${o.lines.length - 1} more`}<span className="block text-xs text-[#151b1c]/45">Return by {formatDate(windowEnd(o)!.toISOString())} · {formatNaira(o.total)}</span></span>
                  <Link to={`/account/returns/new?order=${o.id}`} className={secondaryBtn}>Return items</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Your requests" />
          {mine.length === 0 ? (
            <EmptyState icon={<Undo2 className="h-5 w-5" />} title="No returns yet" body="If something isn’t right with an order, you can start a return above." />
          ) : (
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {mine.map((r) => (
                <li key={r.id}>
                  <Link to={`/account/returns/${r.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6">
                    <span className="w-24 text-sm font-semibold">{r.number}</span>
                    <span className="min-w-0 flex-1 text-sm"><span className="block truncate">{r.lines[0].name}{r.lines.length > 1 && ` + ${r.lines.length - 1} more`}</span><span className="block text-xs text-[#151b1c]/45">{REASONS[r.reason].label} · {formatDate(r.createdAt)}</span></span>
                    <StatusPill tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</StatusPill>
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

import { Link } from 'react-router-dom'
import { PackageSearch } from 'lucide-react'

import { Card, EmptyState, PageHeader, StatusPill, primaryBtn, type Tone } from '@/components/portal/ui'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'
import { useOrdersStore } from '@/modules/orders/orders.store'
import type { CustomerOrderStatus } from '@/modules/orders/types'

export const ORDER_STATUS: Record<CustomerOrderStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'amber' },
  paid: { label: 'Paid · being prepared', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

export default function AccountOrdersPage() {
  useDocumentTitle('My orders')

  const user = useAuthStore((s) => s.user)!
  const all = useOrdersStore((s) => s.orders)
  const orders = all.filter((o) => o.customerEmail === user.email.trim().toLowerCase())

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x space-y-8 py-12 sm:py-16">
        <PageHeader eyebrow="Account" title="My orders" description="Follow your orders and review vendors and delivery once your pieces arrive." />

        {orders.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PackageSearch className="h-5 w-5" />}
              title="No orders yet"
              body="When you buy a piece, it will appear here."
              action={<Link to="/shop" className={primaryBtn}>Explore the collection</Link>}
            />
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {orders.map((o) => {
                const meta = ORDER_STATUS[o.status]
                return (
                  <li key={o.id}>
                    <Link to={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6">
                      <span className="w-24 text-sm font-semibold">{o.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{o.lines[0].name}{o.lines.length > 1 && ` + ${o.lines.length - 1} more`}</span>
                        <span className="block text-xs text-[#151b1c]/45">{formatDate(o.placedAt)}</span>
                      </span>
                      <span className="text-sm font-medium tabular-nums">{formatNaira(o.total)}</span>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
    </main>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReceiptText } from 'lucide-react'

import {
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
} from '@/components/portal/ui'
import { formatDate, timeAgo } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

import { useVendor } from '@/modules/vendors/hooks/useVendor'
import {
  ORDER_STATUS_META,
  isOpenOrder,
  orderItemCount,
} from '@/modules/vendors/lib/orders'

type Tab = 'action' | 'open' | 'delivered' | 'cancelled' | 'all'

const TABS: { id: Tab; label: string }[] = [
  { id: 'action', label: 'Needs action' },
  { id: 'open', label: 'In progress' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
]

const VENDOR_ACTION_STATUSES = new Set(['new', 'confirmed', 'packing'])

export default function VendorOrdersPage() {
  useDocumentTitle('Orders')

  const { workspace } = useVendor()
  const [tab, setTab] = useState<Tab>('action')

  const sorted = [...workspace.orders].sort(
    (a, b) => +new Date(b.placedAt) - +new Date(a.placedAt),
  )

  const match = (status: string, isOpen: boolean): Record<Tab, boolean> => ({
    action: VENDOR_ACTION_STATUSES.has(status),
    open: isOpen,
    delivered: status === 'delivered',
    cancelled: status === 'cancelled',
    all: true,
  })

  const visible = sorted.filter((o) => match(o.status, isOpenOrder(o))[tab])
  const count = (t: Tab) => sorted.filter((o) => match(o.status, isOpenOrder(o))[t]).length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Confirm, pack and hand over. Karta logistics takes it from there."
      />

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="No orders yet"
            body="Orders appear here as soon as a customer buys one of your live products."
          />
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Filter orders" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  tab === t.id
                    ? 'border-[#151b1c] bg-[#151b1c] text-white'
                    : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'
                }`}
              >
                {t.label} <span className="ml-1 opacity-60">{count(t.id)}</span>
              </button>
            ))}
          </div>

          <Card>
            {visible.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-[#151b1c]/45">
                Nothing here right now.
              </p>
            ) : (
              <ul className="divide-y divide-[#151b1c]/[0.07]">
                {visible.map((o) => {
                  const meta = ORDER_STATUS_META[o.status]
                  return (
                    <li key={o.id}>
                      <Link
                        to={`/vendor/orders/${o.id}`}
                        className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                      >
                        <span className="w-24 text-sm font-semibold">{o.number}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {o.lines[0].name}
                            {o.lines.length > 1 && ` + ${o.lines.length - 1} more`}
                          </span>
                          <span className="block text-xs text-[#151b1c]/45">
                            {o.customerLabel} · {o.city}, {o.state} · {orderItemCount(o)} item
                            {orderItemCount(o) === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="text-xs text-[#151b1c]/40" title={formatDate(o.placedAt)}>
                          {timeAgo(o.placedAt)}
                        </span>
                        <span className="w-28 text-right text-sm font-medium tabular-nums">
                          {formatNaira(o.subtotal)}
                        </span>
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

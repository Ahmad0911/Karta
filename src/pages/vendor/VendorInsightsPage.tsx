import { BarChart3 } from 'lucide-react'

import { Card, CardHeader, EmptyState, PageHeader, StatCard } from '@/components/portal/ui'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

import { useVendor } from '@/modules/vendors/hooks/useVendor'
import { ORDER_STATUS_META } from '@/modules/vendors/lib/orders'
import type { OrderStatus } from '@/modules/vendors/types'

export default function VendorInsightsPage() {
  useDocumentTitle('Insights')

  const { workspace } = useVendor()
  const { orders } = workspace

  const valid = orders.filter((o) => o.status !== 'cancelled')
  const revenue = valid.reduce((s, o) => s + o.subtotal, 0)
  const aov = valid.length ? Math.round(revenue / valid.length) : 0
  const cancelRate = orders.length
    ? Math.round((orders.filter((o) => o.status === 'cancelled').length / orders.length) * 100)
    : 0

  // Units sold per product
  const units = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const o of valid) {
    for (const l of o.lines) {
      const row = units.get(l.listingId) ?? { name: l.name, qty: 0, revenue: 0 }
      row.qty += l.qty
      row.revenue += l.qty * l.unitPrice
      units.set(l.listingId, row)
    }
  }
  const top = [...units.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
  const topMax = Math.max(...top.map((t) => t.qty), 1)

  const byStatus = (Object.keys(ORDER_STATUS_META) as OrderStatus[])
    .map((s) => ({ s, n: orders.filter((o) => o.status === s).length }))
    .filter((x) => x.n > 0)

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Performance" title="Insights" description="How your pieces are performing across all orders." />

      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="Insights will appear with your first orders"
            body="We’ll show best sellers, average order value and fulfilment quality."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Gross sales" value={formatNaira(revenue)} hint="Before commission" />
            <StatCard label="Orders" value={orders.length} hint={`${valid.length} not cancelled`} />
            <StatCard label="Average order" value={formatNaira(aov)} />
            <StatCard
              label="Cancellation rate"
              value={`${cancelRate}%`}
              hint="Lower is better for trust"
              tone={cancelRate > 10 ? 'alert' : 'neutral'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Best sellers" description="By units sold" />
              <ul className="space-y-4 p-5 sm:p-6">
                {top.map((t) => (
                  <li key={t.name}>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="truncate">{t.name}</span>
                      <span className="shrink-0 tabular-nums text-[#151b1c]/55">
                        {t.qty} sold · {formatNaira(t.revenue)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#151b1c]/[0.07]">
                      <div className="h-full rounded-full bg-[#151b1c]" style={{ width: `${(t.qty / topMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Orders by stage" />
              <ul className="divide-y divide-[#151b1c]/[0.07]">
                {byStatus.map(({ s, n }) => (
                  <li key={s} className="flex items-center justify-between px-5 py-3.5 text-sm sm:px-6">
                    <span>{ORDER_STATUS_META[s].label}</span>
                    <span className="font-medium tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

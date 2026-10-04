import { useState } from 'react'
import { PackageCheck, Search } from 'lucide-react'

import { Card, EmptyState, PageHeader, inputClass } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

import DeliveryRow from '@/modules/logistics/components/DeliveryRow'
import { useLogistics } from '@/modules/logistics/hooks/useLogistics'
import type { Delivery } from '@/modules/logistics/types'

type Tab = 'active' | 'failed' | 'delivered' | 'all'

const TABS: { id: Tab; label: string; test: (d: Delivery) => boolean }[] = [
  { id: 'active', label: 'Active', test: (d) => d.status !== 'delivered' },
  { id: 'failed', label: 'Failed', test: (d) => d.status === 'failed' },
  { id: 'delivered', label: 'Delivered', test: (d) => d.status === 'delivered' },
  { id: 'all', label: 'All', test: () => true },
]

export default function LogisticsDeliveriesPage() {
  useDocumentTitle('Deliveries')

  const { deliveries } = useLogistics()
  const [tab, setTab] = useState<Tab>('active')
  const [query, setQuery] = useState('')

  const current = TABS.find((t) => t.id === tab)!
  const q = query.trim().toLowerCase()

  const visible = deliveries
    .filter(current.test)
    .filter(
      (d) =>
        !q ||
        d.orderNumber.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.dropoffAddress.toLowerCase().includes(q),
    )

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Logistics" title="Deliveries" />

      {deliveries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageCheck className="h-5 w-5" />}
            title="Nothing assigned yet"
            body="Jobs assigned to you by Karta operations will be listed here."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Filter deliveries" className="flex flex-wrap gap-2">
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
                  {t.label} <span className="ml-1 opacity-60">{deliveries.filter(t.test).length}</span>
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#151b1c]/35" />
              <input
                type="search"
                aria-label="Search deliveries"
                placeholder="Order, customer or address"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputClass()} !h-11 pl-11`}
              />
            </div>
          </div>

          <Card>
            {visible.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-[#151b1c]/45">
                No deliveries match this view.
              </p>
            ) : (
              <ul className="divide-y divide-[#151b1c]/[0.07]">
                {visible.map((d) => (
                  <li key={d.id}>
                    <DeliveryRow delivery={d} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

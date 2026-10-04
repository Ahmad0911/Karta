import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Truck } from 'lucide-react'

import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  primaryBtn,
  secondaryBtn,
} from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { Stars } from '@/modules/reviews/components/Stars'
import { summarize } from '@/modules/reviews/lib'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import { DEFAULT_COURIER } from '@/config/checkout'
import { toast } from '@/store/toast.store'
import { useAuthStore } from '@/store/auth.store'

import DeliveryRow from '@/modules/logistics/components/DeliveryRow'
import { useLogistics } from '@/modules/logistics/hooks/useLogistics'
import { isActive } from '@/modules/logistics/lib/deliveries'
import { useLogisticsStore } from '@/modules/logistics/store/logistics.store'
import type { DeliveryStatus } from '@/modules/logistics/types'

/** What the driver should look at first. */
const PRIORITY: Record<DeliveryStatus, number> = {
  out_for_delivery: 0,
  failed: 1,
  in_transit: 2,
  picked_up: 3,
  assigned: 4,
  delivered: 5,
}

export default function LogisticsDashboardPage() {
  useDocumentTitle('Logistics')

  const user = useAuthStore((s) => s.user)!
  const { email, deliveries } = useLogistics()
  const loadDemo = useLogisticsStore((s) => s.devLoadDemo)
  const reset = useLogisticsStore((s) => s.devReset)

  // Select the stable array, filter afterwards. A selector that builds a new
  // array on every call makes zustand v5 re-render forever.
  const allReviews = useReviewsStore((s) => s.reviews)
  const rating = useMemo(
    () => summarize(allReviews.filter((r) => r.target === 'logistics' && r.targetId === DEFAULT_COURIER.id)),
    [allReviews],
  )

  const firstName = user.name.trim().split(/\s+/)[0] || 'there'
  const active = deliveries.filter(isActive)
  const upNext = [...active].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status])

  const count = (s: DeliveryStatus) => deliveries.filter((d) => d.status === s).length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Logistics"
        title={`Hello, ${firstName}.`}
        description="Your deliveries for today, most urgent first."
        actions={
          active.length > 0 ? (
            <Link to="/logistics/deliveries" className={secondaryBtn}>
              All deliveries
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="To collect" value={count('assigned')} hint="Waiting at vendors" />
        <StatCard
          label="On the road"
          value={count('picked_up') + count('in_transit') + count('out_for_delivery')}
        />
        <StatCard
          label="Needs retry"
          value={count('failed')}
          tone={count('failed') ? 'alert' : 'neutral'}
          hint="Failed attempts"
        />
        <StatCard label="Delivered" value={count('delivered')} />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40">Customer rating · {DEFAULT_COURIER.name}</p>
          {rating.count > 0 ? (
            <p className="mt-2 flex items-center gap-3 text-sm">
              <Stars value={rating.average} size={18} />
              <strong className="font-display text-2xl">{rating.average.toFixed(1)}</strong>
              <span className="text-[#151b1c]/50">from {rating.count} verified deliveries</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#151b1c]/50">Customers can rate delivery after each order. Ratings appear here.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Up next" description={`${active.length} active`} />

        {upNext.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-5 w-5" />}
            title={deliveries.length ? 'All deliveries complete' : 'No deliveries assigned yet'}
            body={
              deliveries.length
                ? 'Great work. New jobs appear here when Karta operations assigns them.'
                : 'When Karta operations assigns you a job, it will appear here with the pickup and drop-off details.'
            }
          />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {upNext.map((d) => (
              <li key={d.id}>
                <DeliveryRow delivery={d} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {import.meta.env.DEV && (
        <section
          aria-label="Developer mock controls"
          className="rounded-[1.25rem] border border-dashed border-[#8f7651]/50 bg-[#b79a6b]/[0.08] p-5"
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6540]">
            <FlaskConical className="h-4 w-4" />
            Dev only · simulates Karta operations assigning jobs
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                loadDemo(email)
                toast.info('Sample deliveries assigned')
              }}
            >
              Assign sample deliveries
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                reset(email)
                toast.info('Deliveries cleared')
              }}
            >
              Clear
            </button>
          </div>
          <p className="mt-3 text-xs text-[#151b1c]/50">
            Tip: the delivery codes for the samples are 4821, 7350, 1096, 5547 and 2204.
          </p>
        </section>
      )}
    </div>
  )
}

import { Landmark, Wallet } from 'lucide-react'

import {
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  StatCard,
  StatusPill,
} from '@/components/portal/ui'
import { COMPANY, POLICY } from '@/config/company'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

import { useVendor } from '@/modules/vendors/hooks/useVendor'
import { computeBalances, nextPayoutDate, releaseDate } from '@/modules/vendors/lib/finance'

export default function VendorPayoutsPage() {
  useDocumentTitle('Payouts')

  const { workspace } = useVendor()
  const { orders, payouts, profile } = workspace

  const balances = computeBalances(orders, payouts)
  const nextRun = nextPayoutDate()

  const delivered = orders
    .filter((o) => o.status === 'delivered')
    .sort((a, b) => +new Date(b.deliveredAt ?? 0) - +new Date(a.deliveredAt ?? 0))

  const hasBank = profile.payout.accountNumber.length === 10
  const masked = hasBank
    ? `${profile.payout.bankName} ••••${profile.payout.accountNumber.slice(-4)}`
    : null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance"
        title="Payouts"
        description={`Earnings are released ${POLICY.returnWindowDays} days after delivery, once the return window has closed, and paid every Friday.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available"
          value={formatNaira(balances.available)}
          hint={`Next payout ${formatDate(nextRun.toISOString())}`}
        />
        <StatCard
          label="Held"
          value={formatNaira(balances.held)}
          hint="Delivered, inside the return window"
        />
        <StatCard
          label="In progress"
          value={formatNaira(balances.inProgress)}
          hint="Orders not yet delivered"
        />
        <StatCard label="Paid to date" value={formatNaira(balances.paid)} />
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#151b1c]/[0.08] bg-[#f7f4ee] text-[#8f7651]">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40">
              Paying out to
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {masked ?? 'No bank account added yet'}
            </p>
            {hasBank && (
              <p className="text-xs text-[#151b1c]/45">{profile.payout.accountName}</p>
            )}
          </div>
        </div>
        <a
          href={`mailto:${COMPANY.vendorEmail}?subject=${encodeURIComponent('Change payout account')}`}
          className="text-xs font-semibold text-[#8a6540] underline underline-offset-4"
        >
          Request a change
        </a>
      </Card>

      {!hasBank && (
        <Notice tone="warning" title="Add payout details to get paid">
          Complete the payout section of your vendor application.
        </Notice>
      )}

      {/* ------------------------------ History ------------------------------ */}
      <Card>
        <CardHeader title="Payout history" />
        {payouts.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-5 w-5" />}
            title="No payouts yet"
            body="Your first payout appears after an order is delivered and its return window has passed."
          />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {[...payouts]
              .sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt))
              .map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
                  <span className="w-32 text-sm font-semibold">{p.reference}</span>
                  <span className="flex-1 text-xs text-[#151b1c]/45">
                    {formatDate(p.paidAt)} · {p.bankLabel} · {p.orderIds.length} order
                    {p.orderIds.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatNaira(p.amount)}</span>
                  <StatusPill tone="green">Paid</StatusPill>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {/* ----------------------------- Order earnings ----------------------------- */}
      {delivered.length > 0 && (
        <Card>
          <CardHeader title="Earnings by order" description="Delivered orders only" />
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {delivered.map((o) => {
              const release = releaseDate(o)
              const held = !o.payoutId && release && release.getTime() > Date.now()
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
                  <span className="w-24 text-sm font-semibold">{o.number}</span>
                  <span className="flex-1 text-xs text-[#151b1c]/45">
                    Delivered {o.deliveredAt ? formatDate(o.deliveredAt) : ''} · {formatNaira(o.subtotal)} −{' '}
                    {formatNaira(o.commission)} commission
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatNaira(o.netEarning)}</span>
                  <StatusPill tone={o.payoutId ? 'green' : held ? 'amber' : 'blue'}>
                    {o.payoutId ? 'Paid' : held ? `Held to ${formatDate(release!.toISOString())}` : 'Ready'}
                  </StatusPill>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  PackageX,
  ReceiptText,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  StatCard,
  StatusPill,
  primaryBtn,
} from '@/components/portal/ui'
import { formatNaira } from '@/lib/format'
import { formatShortDate, timeAgo } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'

import DevPanel from '@/modules/vendors/components/DevPanel'
import TrustBadge from '@/modules/vendors/components/TrustBadge'
import { VENDOR_POLICY } from '@/modules/vendors/config'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import { earningsByDay } from '@/modules/vendors/lib/finance'
import { completionPercent } from '@/modules/vendors/lib/onboarding'
import { ORDER_STATUS_META, orderItemCount } from '@/modules/vendors/lib/orders'

export default function VendorDashboardPage() {
  useDocumentTitle('Vendor overview')

  const user = useAuthStore((s) => s.user)!
  const { workspace } = useVendor()
  const { profile, orders, listings } = workspace

  const firstName = user.name.trim().split(/\s+/)[0] || 'there'
  const approved = profile.status === 'approved'

  const last30 = earningsByDay(orders, 30)
  const earnings30 = last30.reduce((s, d) => s + d.amount, 0)
  const chart = last30.slice(-14)
  const chartMax = Math.max(...chart.map((d) => d.amount), 1)

  const newOrders = orders.filter((o) => o.status === 'new')
  const live = listings.filter((l) => l.status === 'live')
  const outOfStock = live.filter((l) => l.stock === 0)
  const lowStock = live.filter(
    (l) => l.stock > 0 && l.stock <= VENDOR_POLICY.lowStockThreshold,
  )
  const recent = [...orders]
    .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt))
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={profile.business.name || 'Your store'}
        title={`Welcome, ${firstName}.`}
        description="A quick look at how your store is doing today."
        actions={
          approved ? (
            <TrustBadge
              vendorName={profile.business.name || 'Your store'}
              score={profile.trustScore}
            />
          ) : undefined
        }
      />

      {/* ------------------------------ Status banner ----------------------------- */}

      {profile.status === 'draft' && (
        <Notice
          tone="warning"
          title="Finish your application to start selling"
          action={
            <Link to="/vendor/onboarding" className={primaryBtn}>
              Continue · {completionPercent(profile)}% done
            </Link>
          }
        >
          Tell us about your business, upload your documents and add payout
          details. You can save and come back at any time.
        </Notice>
      )}

      {profile.status === 'under_review' && (
        <Notice tone="info" title="Your application is under review">
          Our team usually responds within 2 to 3 working days. In the meantime
          you can prepare product drafts.
        </Notice>
      )}

      {profile.status === 'rejected' && (
        <Notice tone="danger" title="Your application wasn’t approved">
          {profile.reviewNote} If you think this is a mistake, contact the vendor team.
        </Notice>
      )}

      {profile.status === 'suspended' && (
        <Notice tone="danger" title="Your store is suspended">
          {profile.reviewNote} Your products are hidden from the storefront. Contact the
          vendor team to resolve this.
        </Notice>
      )}

      {profile.status === 'changes_requested' && (
        <Notice
          tone="danger"
          title="We need a few changes"
          action={
            <Link to="/vendor/onboarding" className={primaryBtn}>
              Update application
            </Link>
          }
        >
          {profile.reviewNote}
        </Notice>
      )}

      {/* --------------------------------- Stats --------------------------------- */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Earnings · 30 days"
          value={formatNaira(earnings30)}
          hint="After Karta commission"
        />
        <StatCard
          label="New orders"
          value={newOrders.length}
          hint={
            newOrders.length
              ? `Confirm within ${VENDOR_POLICY.confirmWithinHours} hours`
              : 'Nothing waiting'
          }
          tone={newOrders.length ? 'alert' : 'neutral'}
          to="/vendor/orders"
        />
        <StatCard
          label="Live products"
          value={live.length}
          hint={`${listings.length} in total`}
          to="/vendor/products"
        />
        <StatCard
          label="Stock alerts"
          value={outOfStock.length + lowStock.length}
          hint={`${outOfStock.length} out · ${lowStock.length} low`}
          tone={outOfStock.length + lowStock.length ? 'alert' : 'neutral'}
          to="/vendor/products"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* -------------------------------- Chart -------------------------------- */}
        <Card>
          <CardHeader title="Earnings" description="Last 14 days, after commission" />
          <div className="px-5 pb-6 pt-5 sm:px-6">
            {earnings30 === 0 ? (
              <p className="py-10 text-center text-sm text-[#151b1c]/45">
                Earnings will appear here once you receive orders.
              </p>
            ) : (
              <div
                role="img"
                aria-label={`Bar chart of daily earnings for the last 14 days. Total ${formatNaira(
                  chart.reduce((s, d) => s + d.amount, 0),
                )}.`}
                className="flex h-44 items-end gap-1.5"
              >
                {chart.map((d) => (
                  <div key={d.date.toISOString()} className="group flex h-full flex-1 flex-col justify-end">
                    <div
                      title={`${formatShortDate(d.date.toISOString())}: ${formatNaira(d.amount)}`}
                      className="w-full rounded-t-md bg-[#151b1c]/80 transition group-hover:bg-[#8f7651]"
                      style={{ height: `${Math.max((d.amount / chartMax) * 100, d.amount ? 4 : 1)}%` }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-[#151b1c]/35">
              <span>{formatShortDate(chart[0].date.toISOString())}</span>
              <span>Today</span>
            </div>
          </div>
        </Card>

        {/* ---------------------------- Needs attention --------------------------- */}
        <Card>
          <CardHeader title="Needs attention" />
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {newOrders.slice(0, 3).map((o) => (
              <li key={o.id}>
                <Link
                  to={`/vendor/orders/${o.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                >
                  <ReceiptText className="h-4 w-4 shrink-0 text-[#8f7651]" />
                  <span className="flex-1 text-sm">
                    Confirm order <strong>{o.number}</strong>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#151b1c]/30" />
                </Link>
              </li>
            ))}

            {outOfStock.slice(0, 2).map((l) => (
              <li key={l.id}>
                <Link
                  to={`/vendor/products/${l.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                >
                  <PackageX className="h-4 w-4 shrink-0 text-[#9b302d]" />
                  <span className="flex-1 text-sm">
                    <strong>{l.name}</strong> is out of stock
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#151b1c]/30" />
                </Link>
              </li>
            ))}

            {lowStock.slice(0, 2).map((l) => (
              <li key={l.id}>
                <Link
                  to={`/vendor/products/${l.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#b7791f]" />
                  <span className="flex-1 text-sm">
                    Only {l.stock} left of <strong>{l.name}</strong>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#151b1c]/30" />
                </Link>
              </li>
            ))}
          </ul>

          {newOrders.length + outOfStock.length + lowStock.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-[#151b1c]/45">
              You’re all caught up.
            </p>
          )}
        </Card>
      </div>

      {/* ------------------------------ Recent orders ----------------------------- */}

      <Card>
        <CardHeader
          title="Recent orders"
          action={
            orders.length > 0 ? (
              <Link to="/vendor/orders" className="text-xs font-semibold text-[#8a6540] underline underline-offset-4">
                View all
              </Link>
            ) : undefined
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No orders yet"
            body={
              approved
                ? 'When a customer buys one of your pieces, the order will appear here.'
                : 'Once your application is approved and your products are live, orders will appear here.'
            }
            action={
              <Link to="/vendor/products/new" className={primaryBtn}>
                Add a product
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {recent.map((o) => {
              const meta = ORDER_STATUS_META[o.status]
              return (
                <li key={o.id}>
                  <Link
                    to={`/vendor/orders/${o.id}`}
                    className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                  >
                    <span className="w-24 text-sm font-semibold">{o.number}</span>
                    <span className="min-w-0 flex-1 text-sm text-[#151b1c]/60">
                      {o.customerLabel} · {orderItemCount(o)} item{orderItemCount(o) === 1 ? '' : 's'} · {o.city}
                    </span>
                    <span className="text-xs text-[#151b1c]/40">{timeAgo(o.placedAt)}</span>
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

      <DevPanel />
    </div>
  )
}

import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, MapPin, Truck } from 'lucide-react'

import {
  Card,
  CardHeader,
  FormField,
  Notice,
  PageHeader,
  StatusPill,
  dangerBtn,
  primaryBtn,
  secondaryBtn,
  textareaClass,
} from '@/components/portal/ui'
import { formatDateTime } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import { VENDOR_POLICY } from '@/modules/vendors/config'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import {
  ORDER_STATUS_META,
  TIMELINE,
  VENDOR_NEXT_ACTION,
  canVendorCancel,
} from '@/modules/vendors/lib/orders'
import { releaseDate } from '@/modules/vendors/lib/finance'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import { formatDate } from '@/lib/date'

export default function VendorOrderDetailPage() {
  const { id } = useParams()
  const { email, workspace } = useVendor()
  const advance = useVendorStore((s) => s.advanceOrder)
  const cancel = useVendorStore((s) => s.cancelOrder)

  const order = workspace.orders.find((o) => o.id === id)

  useDocumentTitle(order ? `Order ${order.number}` : 'Order')

  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  if (!order) return <Navigate to="/vendor/orders" replace />

  const meta = ORDER_STATUS_META[order.status]
  const next = VENDOR_NEXT_ACTION[order.status]
  const reached = new Set(order.events.map((e) => e.status))
  const release = releaseDate(order)

  const doAdvance = () => {
    const r = advance(email, order.id)
    if (r.ok) toast.success(`Marked as ${ORDER_STATUS_META[next!.to].label.toLowerCase()}`)
    else toast.error(r.error)
  }

  const doCancel = () => {
    const r = cancel(email, order.id, reason)
    if (!r.ok) {
      setReasonError(r.error)
      return
    }
    toast.success('Order cancelled. The customer has been notified.')
    setCancelling(false)
  }

  return (
    <div className="space-y-8">
      <Link
        to="/vendor/orders"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"
      >
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <PageHeader
        eyebrow={`Placed ${formatDateTime(order.placedAt)}`}
        title={`Order ${order.number}`}
        actions={<StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
      />

      {order.status === 'new' && (
        <Notice tone="warning" title="Confirm within 24 hours">
          Confirming tells the customer you have the piece and are preparing it.
          Orders left unconfirmed for {VENDOR_POLICY.confirmWithinHours} hours may be
          cancelled automatically and affect your trust score.
        </Notice>
      )}

      {order.status === 'cancelled' && (
        <Notice tone="danger" title="This order was cancelled">
          {order.cancelReason}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* ---------------------------- Items ----------------------------- */}
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {order.lines.map((l) => (
                <li key={l.listingId} className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{l.name}</p>
                    <p className="mt-0.5 text-xs text-[#151b1c]/45">
                      {l.qty} × {formatNaira(l.unitPrice)}
                      {l.assembly && ' · Assembly requested'}
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatNaira(l.qty * l.unitPrice)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-[#151b1c]/[0.07] px-5 py-5 text-sm sm:px-6">
              <div className="flex justify-between">
                <dt className="text-[#151b1c]/55">Items subtotal</dt>
                <dd className="tabular-nums">{formatNaira(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#151b1c]/55">
                  Karta commission ({Math.round(VENDOR_POLICY.commissionRate * 100)}%)
                </dt>
                <dd className="tabular-nums text-[#9b302d]">−{formatNaira(order.commission)}</dd>
              </div>
              <div className="flex justify-between border-t border-[#151b1c]/[0.07] pt-3 font-semibold">
                <dt>Your earnings</dt>
                <dd className="tabular-nums">{formatNaira(order.netEarning)}</dd>
              </div>
              {order.status === 'delivered' && release && (
                <p className="pt-1 text-xs text-[#151b1c]/45">
                  {order.payoutId
                    ? 'Paid out.'
                    : release.getTime() > Date.now()
                      ? `Held until ${formatDate(release.toISOString())} (return window).`
                      : 'Ready for the next payout.'}
                </p>
              )}
            </dl>
          </Card>

          {/* --------------------------- Actions ---------------------------- */}
          {(next || canVendorCancel(order.status)) && (
            <Card className="p-5 sm:p-6">
              {!cancelling ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#151b1c]/60">
                    {order.status === 'ready_for_pickup'
                      ? 'Waiting for logistics to collect.'
                      : 'Next step for this order'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canVendorCancel(order.status) && (
                      <button type="button" className={dangerBtn} onClick={() => setCancelling(true)}>
                        Decline order
                      </button>
                    )}
                    {next && (
                      <button type="button" className={primaryBtn} onClick={doAdvance}>
                        <Check className="h-4 w-4" /> {next.label}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <FormField
                    id="cancel-reason"
                    label="Reason for declining"
                    required
                    error={reasonError}
                    hint="The customer sees this. Be clear and polite."
                  >
                    <textarea
                      id="cancel-reason"
                      className={textareaClass(!!reasonError)}
                      value={reason}
                      aria-invalid={reasonError ? true : undefined}
                      aria-describedby="cancel-reason-msg"
                      onChange={(e) => {
                        setReason(e.target.value)
                        setReasonError('')
                      }}
                    />
                  </FormField>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className={secondaryBtn} onClick={() => setCancelling(false)}>
                      Keep order
                    </button>
                    <button type="button" className={dangerBtn} onClick={doCancel}>
                      Decline and notify customer
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* --------------------------- Delivery --------------------------- */}
          <Card>
            <CardHeader title="Deliver to" />
            <div className="space-y-3 px-5 py-5 text-sm sm:px-6">
              <p className="font-semibold">{order.customerLabel}</p>
              <p className="flex items-start gap-2 text-[#151b1c]/60">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8f7651]" />
                {order.city}, {order.state}
              </p>
              <p className="flex items-start gap-2 text-xs leading-5 text-[#151b1c]/40">
                <Truck className="mt-0.5 h-4 w-4 shrink-0" />
                Full address and phone are shared only with the assigned logistics partner.
              </p>
            </div>
          </Card>

          {/* --------------------------- Timeline --------------------------- */}
          {order.status !== 'cancelled' && (
            <Card>
              <CardHeader title="Progress" />
              <ol className="px-5 py-5 sm:px-6">
                {TIMELINE.map((s, i) => {
                  const done = reached.has(s)
                  const event = order.events.find((e) => e.status === s)
                  return (
                    <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < TIMELINE.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[9px] top-5 h-full w-px ${done ? 'bg-[#151b1c]/40' : 'bg-[#151b1c]/10'}`}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          done ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/20 bg-white'
                        }`}
                      >
                        {done && <Check className="h-3 w-3" />}
                      </span>
                      <div>
                        <p className={`text-sm ${done ? 'font-medium' : 'text-[#151b1c]/40'}`}>
                          {ORDER_STATUS_META[s].label}
                          {done ? '' : ' (pending)'}
                        </p>
                        {event && (
                          <p className="text-xs text-[#151b1c]/40">{formatDateTime(event.at)}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'

import { Card, CardHeader, Notice, StatusPill, secondaryBtn } from '@/components/portal/ui'
import { formatDate, formatDateTime } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { canStartReturn } from '@/modules/returns/lib'
import { useReturnsStore } from '@/modules/returns/returns.store'
import ReviewForm from '@/modules/reviews/components/ReviewForm'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import { ORDER_STATUS } from './AccountOrdersPage'

export default function AccountOrderDetailPage() {
  const { id } = useParams()
  const justPaid = (useLocation().state as { justPaid?: boolean } | null)?.justPaid
  const user = useAuthStore((s) => s.user)!
  const order = useOrdersStore((s) => s.orders.find((o) => o.id === id))
  const devDeliver = useOrdersStore((s) => s.devMarkDelivered)
  const reviews = useReviewsStore((s) => s.reviews)
  const allReturns = useReturnsStore((s) => s.returns)
  const [open, setOpen] = useState<string | null>(null)

  useDocumentTitle(order ? `Order ${order.number}` : 'Order')

  // Someone else's order looks exactly like a missing one.
  if (!order || order.customerEmail !== user.email.trim().toLowerCase()) {
    return <Navigate to="/account/orders" replace />
  }

  const meta = ORDER_STATUS[order.status]
  const vendors = [...new Map(order.lines.map((l) => [l.vendorId, l.vendorName])).entries()]

  const reviewed = (target: 'vendor' | 'logistics', targetId: string) =>
    reviews.some((r) => r.orderId === order.id && r.target === target && r.targetId === targetId)

  const targets = [
    ...vendors.map(([vid, name]) => ({ key: `vendor:${vid}`, target: 'vendor' as const, targetId: vid, name, prompt: 'How was the quality and your experience with this vendor?' })),
    { key: `logistics:${order.courier.id}`, target: 'logistics' as const, targetId: order.courier.id, name: order.courier.name, prompt: 'How was the delivery? Timeliness, care and communication.' },
  ]

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-4xl space-y-8 py-12 sm:py-16">
        <Link to="/account/orders" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]">
          <ArrowLeft className="h-4 w-4" /> All orders
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">Placed {formatDate(order.placedAt)}</p>
            <h1 className="mt-2 font-display text-4xl tracking-[-0.035em]">Order {order.number}</h1>
          </div>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>

        {justPaid && (
          <Notice tone="success" title="Payment received. Thank you.">
            Your order has been sent to the vendor. We’ll hold your payment safely until it’s delivered.
          </Notice>
        )}

        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-[#151b1c]/[0.07]">
              {order.lines.map((l) => (
                <li key={l.productId} className="flex justify-between gap-4 px-5 py-4 text-sm sm:px-6">
                  <span>
                    <Link to={`/product/${l.productId}`} className="font-medium underline-offset-4 hover:underline">{l.name}</Link>
                    <span className="block text-xs text-[#151b1c]/45">
                      <Link to={`/vendors/${l.vendorId}`} className="hover:underline">{l.vendorName}</Link> · Qty {l.qty}{l.assembly ? ' · Assembly' : ''}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatNaira(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-[#151b1c]/[0.07] px-5 py-4 text-sm sm:px-6">
              <div className="flex justify-between"><dt className="text-[#151b1c]/55">Items</dt><dd className="tabular-nums">{formatNaira(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#151b1c]/55">Assembly</dt><dd className="tabular-nums">{order.assemblyFee ? formatNaira(order.assemblyFee) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[#151b1c]/55">Delivery</dt><dd className="tabular-nums">{formatNaira(order.deliveryFee)}</dd></div>
              <div className="flex justify-between border-t border-[#151b1c]/[0.07] pt-3 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatNaira(order.total)}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Delivery" />
            <div className="space-y-1 px-5 py-4 text-sm sm:px-6">
              <p className="font-medium">{order.address.fullName}</p>
              <p className="text-[#151b1c]/60">{order.address.street}, {order.address.city}, {order.address.state}</p>
              <p className="text-[#151b1c]/60">{order.address.phone}</p>
              <p className="pt-2 text-xs text-[#151b1c]/45">Courier: {order.courier.name}</p>
              {order.payment.paidAt && <p className="text-xs text-[#151b1c]/45">Paid {formatDateTime(order.payment.paidAt)}</p>}
            </div>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          {canStartReturn(order, allReturns) && <Link to={`/account/returns/new?order=${order.id}`} className={secondaryBtn}>Return an item</Link>}
          <Link to={`/account/support/new?order=${order.id}`} className={secondaryBtn}>Get help with this order</Link>
        </div>

        {/* ------------------------------ Reviews ------------------------------ */}
        {order.status === 'delivered' ? (
          <Card className="p-5 sm:p-7">
            <h2 className="font-display text-2xl tracking-[-0.02em]">How did we do?</h2>
            <p className="mt-1 text-sm text-[#151b1c]/55">Your honest review helps other customers choose, and rewards great vendors.</p>

            <ul className="mt-6 divide-y divide-[#151b1c]/[0.08]">
              {targets.map((t) => (
                <li key={t.key} className="py-5">
                  {reviewed(t.target, t.targetId) ? (
                    <p className="flex items-center gap-2 text-sm text-[#315d4b]"><Check className="h-4 w-4" /> You reviewed {t.name}. Thank you.</p>
                  ) : open === t.key ? (
                    <ReviewForm orderId={order.id} target={t.target} targetId={t.targetId} targetName={t.name} prompt={t.prompt} onDone={() => setOpen(null)} />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm">{t.target === 'vendor' ? 'Review' : 'Rate the delivery by'} <strong>{t.name}</strong></span>
                      <button type="button" className={secondaryBtn} onClick={() => setOpen(t.key)}>Write a review</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ) : order.status === 'paid' ? (
          <>
            <Notice tone="info" title="You can review once your order is delivered">
              Only customers who actually received their order can leave reviews. That keeps ratings trustworthy.
            </Notice>
            {import.meta.env.DEV && (
              <button type="button" className={secondaryBtn} onClick={() => devDeliver(order.id)}>
                Dev: mark this order as delivered
              </button>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}

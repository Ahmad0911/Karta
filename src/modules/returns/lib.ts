import { POLICY } from '@/config/company'
import { addDays } from '@/lib/date'
import type { CustomerOrder } from '@/modules/orders/types'
import type { ReturnReason, ReturnRequest, ReturnStatus } from './types'

export const MAX_PHOTOS = 3

export const REASONS: Record<ReturnReason, { label: string; hint: string; fault: boolean }> = {
  damaged: { label: 'Arrived damaged', hint: 'Broken, scratched, torn or stained on arrival.', fault: true },
  defective: { label: 'Defective or faulty', hint: 'Doesn’t work or wasn’t made properly.', fault: true },
  not_as_described: { label: 'Not as described', hint: 'Different size, material or colour from the listing.', fault: true },
  wrong_item: { label: 'Wrong item sent', hint: 'You received something you didn’t order.', fault: true },
  other: { label: 'Something else', hint: 'Tell us what happened.', fault: false },
}

/** Fault returns need photo evidence. */
export const needsPhotos = (r: ReturnReason) => REASONS[r].fault

export const STATUS_META: Record<ReturnStatus, { label: string; tone: 'neutral' | 'amber' | 'green' | 'red' | 'blue' }> = {
  requested: { label: 'Waiting for vendor', tone: 'amber' },
  approved: { label: 'Approved · item to be collected', tone: 'blue' },
  rejected: { label: 'Declined by vendor', tone: 'red' },
  escalated: { label: 'With Karta', tone: 'amber' },
  received: { label: 'Item received', tone: 'blue' },
  refunded: { label: 'Refunded', tone: 'green' },
  closed: { label: 'Closed', tone: 'neutral' },
}

/** Statuses that still hold the returned quantity. Only "closed" releases it. */
const ACTIVE: ReturnStatus[] = ['requested', 'approved', 'rejected', 'escalated', 'received', 'refunded']

export const windowEnd = (order: CustomerOrder): Date | null =>
  order.deliveredAt ? addDays(order.deliveredAt, POLICY.returnWindowDays) : null

export const withinWindow = (order: CustomerOrder, now = new Date()) => {
  const end = windowEnd(order)
  return Boolean(end && end.getTime() >= now.getTime())
}

/** How many of each product can still be returned from this order. */
export function remainingQty(order: CustomerOrder, returns: ReturnRequest[]): Record<string, number> {
  const used = new Map<string, number>()
  for (const r of returns) {
    if (r.orderId !== order.id || !ACTIVE.includes(r.status)) continue
    for (const l of r.lines) used.set(l.productId, (used.get(l.productId) ?? 0) + l.qty)
  }
  return Object.fromEntries(order.lines.map((l) => [l.productId, Math.max(0, l.qty - (used.get(l.productId) ?? 0))]))
}

export const canStartReturn = (order: CustomerOrder, returns: ReturnRequest[], now = new Date()) =>
  order.status === 'delivered' &&
  withinWindow(order, now) &&
  Object.values(remainingQty(order, returns)).some((n) => n > 0)

/**
 * Refund = price of the returned items. When the fault is the vendor's AND the
 * whole order ends up returned, the delivery fee goes back too (once).
 * CONFIRM this policy with the business.
 */
export function computeRefund(order: CustomerOrder, req: ReturnRequest, all: ReturnRequest[]) {
  const items = req.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)

  // What counts as returned: this request, plus earlier requests already refunded.
  const returned = new Map<string, number>()
  for (const r of all) {
    if (r.orderId !== order.id) continue
    if (r.id !== req.id && r.status !== 'refunded') continue
    for (const l of r.lines) returned.set(l.productId, (returned.get(l.productId) ?? 0) + l.qty)
  }

  const wholeOrder = order.lines.every((l) => (returned.get(l.productId) ?? 0) >= l.qty)
  const includesDelivery = REASONS[req.reason].fault && wholeOrder && !order.deliveryRefunded

  const amount = items + (includesDelivery ? order.deliveryFee : 0)
  return { items, amount, includesDelivery }
}

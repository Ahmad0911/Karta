import type { OrderStatus, VendorOrder } from '../types'

export interface StatusMeta {
  label: string
  tone: 'neutral' | 'amber' | 'green' | 'red' | 'blue'
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  new: { label: 'New', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  packing: { label: 'Packing', tone: 'blue' },
  ready_for_pickup: { label: 'Ready for pickup', tone: 'blue' },
  with_logistics: { label: 'With logistics', tone: 'neutral' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

/** The single next step a vendor is allowed to take. */
export const VENDOR_NEXT_ACTION: Partial<
  Record<OrderStatus, { to: OrderStatus; label: string }>
> = {
  new: { to: 'confirmed', label: 'Confirm order' },
  confirmed: { to: 'packing', label: 'Start packing' },
  packing: { to: 'ready_for_pickup', label: 'Mark ready for pickup' },
}

/** Orders a vendor may still decline (before it is handed over). */
export const canVendorCancel = (status: OrderStatus) =>
  status === 'new' || status === 'confirmed'

export const isOpenOrder = (o: VendorOrder) =>
  o.status !== 'delivered' && o.status !== 'cancelled'

export const orderItemCount = (o: VendorOrder) =>
  o.lines.reduce((sum, l) => sum + l.qty, 0)

/** All statuses shown on the timeline, in order. */
export const TIMELINE: OrderStatus[] = [
  'new',
  'confirmed',
  'packing',
  'ready_for_pickup',
  'with_logistics',
  'delivered',
]

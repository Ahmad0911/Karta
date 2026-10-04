import type { Delivery, DeliveryStatus, FailureReason } from '../types'

export const DELIVERY_META: Record<
  DeliveryStatus,
  { label: string; tone: 'neutral' | 'amber' | 'green' | 'red' | 'blue' }
> = {
  assigned: { label: 'Assigned', tone: 'amber' },
  picked_up: { label: 'Picked up', tone: 'blue' },
  in_transit: { label: 'In transit', tone: 'blue' },
  out_for_delivery: { label: 'Out for delivery', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'green' },
  failed: { label: 'Failed attempt', tone: 'red' },
}

/** The one forward step available from each status (delivery needs proof). */
export const NEXT_STEP: Partial<
  Record<DeliveryStatus, { to: DeliveryStatus; label: string }>
> = {
  assigned: { to: 'picked_up', label: 'Confirm pickup' },
  picked_up: { to: 'in_transit', label: 'Start trip' },
  in_transit: { to: 'out_for_delivery', label: 'Arrived nearby' },
  failed: { to: 'out_for_delivery', label: 'Retry delivery' },
}

export const FAILURE_LABEL: Record<FailureReason, string> = {
  customer_unreachable: 'Customer unreachable',
  wrong_address: 'Wrong or incomplete address',
  customer_refused: 'Customer refused delivery',
  damaged_in_transit: 'Item damaged in transit',
  other: 'Other',
}

export const TIMELINE: DeliveryStatus[] = [
  'assigned',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

/** Delivery can be completed once the driver is at the customer. */
export const canComplete = (s: DeliveryStatus) => s === 'out_for_delivery'
export const canFail = (s: DeliveryStatus) =>
  s === 'out_for_delivery' || s === 'in_transit'

export const isActive = (d: Delivery) => d.status !== 'delivered'

/* ------------------------------ Contact links ----------------------------- */

/** 0803… / +234803… → 234803… for wa.me links. */
export function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return `234${digits.slice(1)}`
  return digits
}

export const telLink = (phone: string) => `tel:+${toInternational(phone)}`

export const whatsappTo = (phone: string, text: string) =>
  `https://wa.me/${toInternational(phone)}?text=${encodeURIComponent(text)}`

export const mapsLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/* ---------------------------------- Dates --------------------------------- */

export const todayKey = () => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

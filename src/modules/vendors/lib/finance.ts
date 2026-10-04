import { POLICY } from '@/config/company'
import { addDays, startOfDay } from '@/lib/date'
import { VENDOR_POLICY } from '../config'
import type { VendorOrder, VendorPayout } from '../types'

export interface Balances {
  /** Delivered, still inside the return window. */
  held: number
  /** Past the return window, waiting for the next payout run. */
  available: number
  /** Already paid out. */
  paid: number
  /** Earnings from orders that are not delivered or cancelled yet. */
  inProgress: number
}

/** The day an order's earnings become payable. */
export const releaseDate = (order: VendorOrder): Date | null =>
  order.deliveredAt ? addDays(order.deliveredAt, POLICY.returnWindowDays) : null

export function computeBalances(
  orders: VendorOrder[],
  payouts: VendorPayout[],
  now = new Date(),
): Balances {
  let held = 0
  let available = 0
  let inProgress = 0

  for (const o of orders) {
    if (o.status === 'cancelled' || o.payoutId) continue

    if (o.status !== 'delivered') {
      inProgress += o.netEarning
      continue
    }

    const release = releaseDate(o)
    if (release && release.getTime() > now.getTime()) held += o.netEarning
    else available += o.netEarning
  }

  const paid = payouts.reduce((sum, p) => sum + p.amount, 0)

  return { held, available, paid, inProgress }
}

/** Next payout weekday strictly after today. */
export function nextPayoutDate(now = new Date()): Date {
  const date = startOfDay(now)
  const diff = (VENDOR_POLICY.payoutWeekday - date.getDay() + 7) % 7 || 7
  return addDays(date, diff)
}

export interface DayRevenue {
  date: Date
  amount: number
}

/** Net earnings per day for the last `days` days (cancelled excluded). */
export function earningsByDay(
  orders: VendorOrder[],
  days: number,
  now = new Date(),
): DayRevenue[] {
  const today = startOfDay(now)
  const buckets: DayRevenue[] = Array.from({ length: days }, (_, i) => ({
    date: addDays(today, i - (days - 1)),
    amount: 0,
  }))

  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const placed = startOfDay(new Date(o.placedAt)).getTime()
    const bucket = buckets.find((b) => b.date.getTime() === placed)
    if (bucket) bucket.amount += o.netEarning
  }

  return buckets
}

export const commissionFor = (subtotal: number) =>
  Math.round(subtotal * VENDOR_POLICY.commissionRate)

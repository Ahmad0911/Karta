import { uuid } from '@/lib/id'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { DEFAULT_COURIER, deliveryFeeFor } from '@/config/checkout'
import { SITE } from '@/config/site'
import { safeStorage } from '@/lib/safeStorage'
import { useAuthStore } from '@/store/auth.store'
import type { Product } from '@/types'
import { toKobo, type ProviderId } from '@/modules/payments'
import { commissionFor } from '@/modules/vendors/lib/finance'
import { useRequestsStore } from '@/modules/requests/requests.store'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import type { VendorOrder } from '@/modules/vendors/types'
import type { CustomerOrder, DeliveryAddress } from './types'

/* -------------------------------------------------------------------------- */
/* Customer orders (MOCK of the order service)                                */
/* -------------------------------------------------------------------------- */
/**
 * An order reaches a vendor ONLY after the payment has been verified as paid
 * for the full amount. Replace each action with the API; the server must
 * enforce the same rules.
 */

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string }

export interface CheckoutItem {
  productId: string
  qty: number
  assembly: boolean
}

interface OrdersState {
  orders: CustomerOrder[]

  createPendingOrder: (input: {
    customerEmail: string
    customerName: string
    address: DeliveryAddress
    items: CheckoutItem[]
    getProduct: (id: string) => Product | undefined
    ownerEmail: (id: string) => string | undefined
  }) => Result<CustomerOrder>

  markPaid: (
    orderId: string,
    payment: { provider: ProviderId; reference: string; paidAmountKobo?: number },
  ) => Result<CustomerOrder>

  markPaymentFailed: (orderId: string, status: 'failed' | 'abandoned', note?: string) => void

  /** Records money returned to the customer. Refuses to exceed what was paid. */
  recordRefund: (orderId: string, amount: number, includesDelivery: boolean) => Result

  devMarkDelivered: (orderId: string) => void
}

const now = () => new Date().toISOString()

const PHONE = /^(?:\+?234|0)[789][01]\d{8}$/

export function validateAddress(a: DeliveryAddress): Record<string, string> {
  const e: Record<string, string> = {}
  if (a.fullName.trim().length < 2) e.fullName = 'Enter the full name of the person receiving the order.'
  if (!PHONE.test(a.phone.replace(/[\s()-]/g, ''))) e.phone = 'Enter a valid Nigerian phone number, for example 0803 123 4567.'
  if (a.street.trim().length < 5) e.street = 'Enter the street address, including the house or plot number.'
  if (a.city.trim().length < 2) e.city = 'Enter the city or town.'
  if (!a.state) e.state = 'Choose the state.'
  return e
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],

      createPendingOrder: ({ customerEmail, customerName, address, items, getProduct, ownerEmail }) => {
        if (items.length === 0) return { ok: false, error: 'Your cart is empty.' }

        // Drivers phone the customer, so the phone must be a real, verified one.
        const buyer = useAuthStore.getState().user
        if (!buyer?.phoneVerified) {
          return { ok: false, error: 'Please verify your phone number before paying.' }
        }

        const problems = validateAddress(address)
        if (Object.keys(problems).length > 0) {
          return { ok: false, error: 'Please check your delivery details.' }
        }

        const vendors = useVendorStore.getState().byEmail
        const lines: CustomerOrder['lines'] = []

        for (const item of items) {
          const p = getProduct(item.productId)
          if (!p) return { ok: false, error: 'An item in your cart is no longer available.' }
          if (!p.inStock) return { ok: false, error: `“${p.name}” is out of stock.` }
          if (!Number.isInteger(item.qty) || item.qty < 1) return { ok: false, error: 'Invalid quantity.' }

          const owner = ownerEmail(p.id)
          if (owner) {
            const listing = vendors[owner]?.listings.find((l) => l.id === p.id)
            if (!listing || listing.stock < item.qty) {
              return { ok: false, error: `Only ${listing?.stock ?? 0} of “${p.name}” left in stock.` }
            }
          }

          lines.push({
            productId: p.id,
            name: p.name,
            qty: item.qty,
            unitPrice: p.price,
            assembly: item.assembly && p.assemblyAvailable,
            vendorId: p.vendor.id,
            vendorName: p.vendor.name,
            vendorEmail: owner,
          })
        }

        const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
        const assemblyFee = lines.reduce((s, l) => s + (l.assembly ? SITE.assemblyFee * l.qty : 0), 0)
        const deliveryFee = deliveryFeeFor(address.state)

        const seq = get().orders.length + 1
        const order: CustomerOrder = {
          id: `ord_${uuid().slice(0, 8)}`,
          number: `KRT-${24200 + seq}`,
          customerEmail: customerEmail.trim().toLowerCase(),
          customerName,
          placedAt: now(),
          lines,
          address,
          subtotal,
          assemblyFee,
          deliveryFee,
          total: subtotal + assemblyFee + deliveryFee,
          status: 'pending_payment',
          payment: { status: 'pending' },
          courier: { ...DEFAULT_COURIER },
        }

        set((s) => ({ orders: [order, ...s.orders] }))
        return { ok: true, data: order }
      },

      markPaid: (orderId, payment) => {
        const order = get().orders.find((o) => o.id === orderId)
        if (!order) return { ok: false, error: 'Order not found.' }

        // Idempotent: a repeated verification must not fan out twice.
        if (order.status === 'paid' || order.status === 'delivered') return { ok: true, data: order }

        // The provider must have collected the FULL amount.
        if (payment.paidAmountKobo !== toKobo(order.total)) {
          get().markPaymentFailed(orderId, 'failed', 'Amount paid did not match the order total.')
          return { ok: false, error: 'The amount paid doesn’t match your order. No money has been taken for this order; contact support.' }
        }

        const paid: CustomerOrder = {
          ...order,
          status: 'paid',
          payment: { ...order.payment, ...payment, status: 'paid', paidAt: now() },
        }

        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? paid : o)) }))

        // A paid custom piece completes its request.
        for (const l of paid.lines) useRequestsStore.getState().markOrdered(l.productId)

        // Fan out one order per platform vendor.
        const byVendor = new Map<string, CustomerOrder['lines']>()
        for (const l of paid.lines) {
          if (!l.vendorEmail) continue
          byVendor.set(l.vendorEmail, [...(byVendor.get(l.vendorEmail) ?? []), l])
        }

        const first = paid.customerName.trim().split(/\s+/)[0] ?? 'Customer'
        const last = paid.customerName.trim().split(/\s+/).slice(1).join(' ')
        const label = last ? `${first} ${last[0].toUpperCase()}.` : first

        for (const [vendorEmail, lines] of byVendor) {
          const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
          const commission = commissionFor(subtotal)

          const vendorOrder: VendorOrder = {
            id: `vo_${paid.id}`,
            number: paid.number,
            customerLabel: label,
            city: paid.address.city,
            state: paid.address.state,
            lines: lines.map((l) => ({
              listingId: l.productId,
              name: l.name,
              qty: l.qty,
              unitPrice: l.unitPrice,
              assembly: l.assembly,
            })),
            subtotal,
            commission,
            netEarning: subtotal - commission,
            status: 'new',
            placedAt: paid.payment.paidAt ?? now(),
            events: [{ status: 'new', at: now() }],
          }

          useVendorStore.getState().receiveOrder(vendorEmail, vendorOrder)
        }

        return { ok: true, data: paid }
      },

      markPaymentFailed: (orderId, status, note) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId && o.status === 'pending_payment'
              ? { ...o, payment: { ...o.payment, status, failureNote: note } }
              : o,
          ),
        })),

      recordRefund: (orderId, amount, includesDelivery) => {
        const order = get().orders.find((o) => o.id === orderId)
        if (!order) return { ok: false, error: 'Order not found.' }
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Invalid refund amount.' }

        const already = order.refundedTotal ?? 0
        if (already + amount > order.total) {
          return { ok: false, error: 'This refund would be more than the customer paid.' }
        }

        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, refundedTotal: already + amount, deliveryRefunded: o.deliveryRefunded || includesDelivery }
              : o,
          ),
        }))
        return { ok: true }
      },

      devMarkDelivered: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId)
        if (!order || order.status !== 'paid') return

        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status: 'delivered', deliveredAt: now() } : o,
          ),
        }))

        for (const email of new Set(order.lines.map((l) => l.vendorEmail).filter(Boolean) as string[])) {
          useVendorStore.getState().devMarkOrderDelivered(email, `vo_${order.id}`)
        }
      },
    }),
    { name: 'karta-orders', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

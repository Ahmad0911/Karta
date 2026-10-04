import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { uuid } from '@/lib/id'
import { safeStorage } from '@/lib/safeStorage'
import { useAuthStore } from '@/store/auth.store'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { resolvePaymentProvider, toKobo } from '@/modules/payments'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import { MAX_PHOTOS, REASONS, canStartReturn, computeRefund, needsPhotos, remainingQty, withinWindow } from './lib'
import type { ReturnEvent, ReturnLine, ReturnReason, ReturnRequest } from './types'

/* -------------------------------------------------------------------------- */
/* Returns & refunds (MOCK of the returns service)                            */
/* -------------------------------------------------------------------------- */
/**
 * Every transition checks WHO is acting and what state the request is in.
 * The server must enforce the same rules; nothing here is a security boundary.
 * Money moves only through the payment provider, and only once per request.
 */

type Result = { ok: true } | { ok: false; error: string }
type CreateResult = { ok: true; data: ReturnRequest } | { ok: false; error: string }

interface ReturnsState {
  returns: ReturnRequest[]

  create: (input: {
    orderId: string
    items: { productId: string; qty: number }[]
    reason: ReturnReason
    details: string
    photos: string[]
  }) => CreateResult

  cancel: (id: string) => Result
  escalate: (id: string, note: string) => Result
  vendorDecide: (id: string, decision: 'approve' | 'reject', note: string) => Result
  adminDecide: (id: string, decision: 'uphold' | 'dismiss', note: string) => Result
  markReceived: (id: string) => Result
  issueRefund: (id: string) => Promise<Result>
}

const now = () => new Date().toISOString()
const norm = (e: string) => e.trim().toLowerCase()
const isStaff = () => {
  const u = useAuthStore.getState().user
  return Boolean(u && (u.role === 'admin' || u.role === 'super_admin'))
}
const ev = (by: ReturnEvent['by'], action: string, note?: string): ReturnEvent => ({ id: uuid(), at: now(), by, action, note: note?.trim() || undefined })

/** Returns being paid out right now (stops a double-click paying twice). */
const refunding = new Set<string>()

export const useReturnsStore = create<ReturnsState>()(
  persist(
    (set, get) => {
      const find = (id: string) => get().returns.find((r) => r.id === id)
      const patch = (id: string, fn: (r: ReturnRequest) => ReturnRequest) =>
        set((s) => ({ returns: s.returns.map((r) => (r.id === id ? { ...fn(r), updatedAt: now() } : r)) }))

      return {
        returns: [],

        create: ({ orderId, items, reason, details, photos }) => {
          const user = useAuthStore.getState().user
          if (!user) return { ok: false, error: 'Please sign in.' }

          const order = useOrdersStore.getState().orders.find((o) => o.id === orderId)
          if (!order || norm(order.customerEmail) !== norm(user.email)) {
            return { ok: false, error: 'You can only return items from your own orders.' }
          }
          if (order.status !== 'delivered') return { ok: false, error: 'You can return items once your order is delivered.' }
          if (!withinWindow(order)) return { ok: false, error: 'The return window for this order has closed.' }

          const left = remainingQty(order, get().returns)
          if (items.length === 0) return { ok: false, error: 'Choose at least one item to return.' }

          const lines: ReturnLine[] = []
          for (const it of items) {
            const line = order.lines.find((l) => l.productId === it.productId)
            if (!line) return { ok: false, error: 'That item isn’t part of this order.' }
            if (!Number.isInteger(it.qty) || it.qty < 1) return { ok: false, error: 'Choose a quantity of at least 1.' }
            if (it.qty > (left[it.productId] ?? 0)) return { ok: false, error: `You can return at most ${left[it.productId] ?? 0} of “${line.name}”.` }
            lines.push({ productId: line.productId, name: line.name, qty: it.qty, unitPrice: line.unitPrice, vendorId: line.vendorId, vendorName: line.vendorName, vendorEmail: line.vendorEmail })
          }

          // One request deals with one vendor, so one person decides it.
          if (new Set(lines.map((l) => l.vendorId)).size > 1) {
            return { ok: false, error: 'Please return items from different vendors in separate requests.' }
          }

          const text = details.trim()
          if (text.length < (reason === 'other' ? 20 : 10)) {
            return { ok: false, error: reason === 'other' ? 'Please explain what happened (at least 20 characters).' : 'Please describe the problem (at least 10 characters).' }
          }
          if (needsPhotos(reason) && photos.length === 0) return { ok: false, error: 'Add at least one clear photo showing the problem.' }
          if (photos.length > MAX_PHOTOS) return { ok: false, error: `You can add up to ${MAX_PHOTOS} photos.` }

          const [first, ...rest] = user.name.trim().split(/\s+/)
          const label = rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first

          // Vendors without a portal can't respond, so Karta handles those directly.
          const noPortal = lines.some((l) => !l.vendorEmail)

          const req: ReturnRequest = {
            id: `ret_${uuid().slice(0, 8)}`,
            number: `RET-${String(get().returns.length + 1001)}`,
            orderId: order.id,
            orderNumber: order.number,
            customerEmail: norm(user.email),
            customerLabel: label,
            lines,
            reason,
            details: text,
            photos,
            status: noPortal ? 'escalated' : 'requested',
            events: [
              ev('customer', 'Return requested', `${REASONS[reason].label}: ${text}`),
              ...(noPortal ? [ev('system', 'Sent to Karta', 'This vendor doesn’t use the vendor portal, so the Karta team will handle it.')] : []),
            ],
            createdAt: now(),
            updatedAt: now(),
          }

          set((s) => ({ returns: [req, ...s.returns] }))
          return { ok: true, data: req }
        },

        cancel: (id) => {
          const user = useAuthStore.getState().user
          const r = find(id)
          if (!user || !r || norm(r.customerEmail) !== norm(user.email)) return { ok: false, error: 'Return not found.' }
          if (r.status !== 'requested') return { ok: false, error: 'This return can no longer be cancelled.' }
          patch(id, (x) => ({ ...x, status: 'closed', events: [...x.events, ev('customer', 'Cancelled by customer')] }))
          return { ok: true }
        },

        escalate: (id, note) => {
          const user = useAuthStore.getState().user
          const r = find(id)
          if (!user || !r || norm(r.customerEmail) !== norm(user.email)) return { ok: false, error: 'Return not found.' }
          if (r.status !== 'rejected') return { ok: false, error: 'Only a declined return can be escalated.' }
          if (note.trim().length < 10) return { ok: false, error: 'Tell us why you disagree (at least 10 characters).' }
          patch(id, (x) => ({ ...x, status: 'escalated', customerNote: note.trim(), events: [...x.events, ev('customer', 'Escalated to Karta', note)] }))
          return { ok: true }
        },

        vendorDecide: (id, decision, note) => {
          const user = useAuthStore.getState().user
          const r = find(id)
          if (!user || !r) return { ok: false, error: 'Return not found.' }

          // Only the vendor who sold the items may answer.
          const mine = user.role === 'vendor' && r.lines.every((l) => l.vendorEmail && norm(l.vendorEmail) === norm(user.email))
          if (!mine) return { ok: false, error: 'Only the selling vendor can respond to this return.' }
          if (r.status !== 'requested') return { ok: false, error: 'This return has already been answered.' }
          if (decision === 'reject' && note.trim().length < 10) return { ok: false, error: 'Explain your decision (at least 10 characters). The customer will see it.' }

          patch(id, (x) => ({
            ...x,
            status: decision === 'approve' ? 'approved' : 'rejected',
            vendorNote: note.trim() || undefined,
            events: [...x.events, ev('vendor', decision === 'approve' ? 'Approved by vendor' : 'Declined by vendor', note)],
          }))
          return { ok: true }
        },

        adminDecide: (id, decision, note) => {
          if (!isStaff()) return { ok: false, error: 'Only Karta staff can decide escalated returns.' }
          const r = find(id)
          if (!r) return { ok: false, error: 'Return not found.' }
          if (r.status !== 'escalated') return { ok: false, error: 'This return isn’t waiting for a Karta decision.' }
          if (note.trim().length < 10) return { ok: false, error: 'Record the reason for your decision (at least 10 characters).' }

          patch(id, (x) => ({
            ...x,
            status: decision === 'uphold' ? 'approved' : 'closed',
            adminNote: note.trim(),
            events: [...x.events, ev('admin', decision === 'uphold' ? 'Approved by Karta' : 'Dismissed by Karta', note)],
          }))
          return { ok: true }
        },

        markReceived: (id) => {
          if (!isStaff()) return { ok: false, error: 'Only Karta staff can confirm receipt.' }
          const r = find(id)
          if (!r) return { ok: false, error: 'Return not found.' }
          if (r.status !== 'approved') return { ok: false, error: 'Only an approved return can be marked as received.' }
          patch(id, (x) => ({ ...x, status: 'received', events: [...x.events, ev('admin', 'Item received and checked')] }))
          return { ok: true }
        },

        issueRefund: async (id) => {
          if (!isStaff()) return { ok: false, error: 'Only Karta staff can issue refunds.' }
          const r = find(id)
          if (!r) return { ok: false, error: 'Return not found.' }
          if (r.status !== 'received') return { ok: false, error: 'Refunds are issued after the item is received.' }
          if (r.refund) return { ok: false, error: 'This return has already been refunded.' }
          if (refunding.has(id)) return { ok: false, error: 'This refund is already being processed.' }

          const order = useOrdersStore.getState().orders.find((o) => o.id === r.orderId)
          if (!order?.payment.reference) return { ok: false, error: 'No payment is recorded for this order.' }

          const { amount, items, includesDelivery } = computeRefund(order, r, get().returns)
          if (amount + (order.refundedTotal ?? 0) > order.total) return { ok: false, error: 'This refund would be more than the customer paid.' }

          const provider = resolvePaymentProvider()
          if (!provider.ok) return { ok: false, error: provider.reason }

          refunding.add(id)
          try {
            const res = await provider.provider.refund(order.payment.reference, toKobo(amount), `Return ${r.number}`)
            if (res.status === 'failed') return { ok: false, error: res.error ?? 'The payment provider could not process the refund.' }

            const booked = useOrdersStore.getState().recordRefund(order.id, amount, includesDelivery)
            if (!booked.ok) return booked

            // The vendor no longer keeps the money for items that came back.
            const vendorEmails = new Set(r.lines.map((l) => l.vendorEmail).filter(Boolean) as string[])
            for (const email of vendorEmails) useVendorStore.getState().adjustForRefund(email, `vo_${order.id}`, items)

            patch(id, (x) => ({
              ...x,
              status: 'refunded',
              refund: { amount, status: res.status === 'pending' ? 'pending' : 'completed', reference: res.reference, provider: provider.provider.id, at: now(), includesDelivery },
              events: [...x.events, ev('admin', 'Refund issued', `${res.status === 'pending' ? 'Pending' : 'Completed'}: ₦${amount.toLocaleString('en-NG')}`)],
            }))
            return { ok: true }
          } finally {
            refunding.delete(id)
          }
        },
      }
    },
    { name: 'karta-returns', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

export { canStartReturn }

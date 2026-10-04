import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { uuid } from '@/lib/id'
import { safeStorage } from '@/lib/safeStorage'
import { useAuthStore } from '@/store/auth.store'
import { useOrdersStore } from '@/modules/orders/orders.store'

/* -------------------------------------------------------------------------- */
/* Support tickets (MOCK of the support service)                              */
/* -------------------------------------------------------------------------- */

export type TicketCategory = 'order' | 'payment' | 'delivery' | 'return' | 'account' | 'vendor' | 'other'
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'

export const CATEGORIES: Record<TicketCategory, string> = {
  order: 'My order',
  payment: 'Payment or refund',
  delivery: 'Delivery',
  return: 'A return',
  account: 'My account',
  vendor: 'A vendor',
  other: 'Something else',
}

export const STATUS: Record<TicketStatus, { label: string; tone: 'amber' | 'blue' | 'green' | 'neutral' }> = {
  open: { label: 'Waiting for Karta', tone: 'amber' },
  pending: { label: 'Waiting for you', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
  closed: { label: 'Closed', tone: 'neutral' },
}

export interface TicketMessage {
  id: string
  from: 'requester' | 'staff'
  author: string
  body: string
  at: string
  /** Staff-only note. Never shown to the requester. */
  internal?: boolean
}

export interface SupportTicket {
  id: string
  number: string
  requesterEmail: string
  requesterName: string
  subject: string
  category: TicketCategory
  orderId?: string
  status: TicketStatus
  messages: TicketMessage[]
  createdAt: string
  updatedAt: string
}

export const LIMITS = { maxOpen: 3, maxPerDay: 5, subject: [5, 120], body: [10, 2000] } as const

type Result = { ok: true } | { ok: false; error: string }
type CreateResult = { ok: true; data: SupportTicket } | { ok: false; error: string }

interface State {
  tickets: SupportTicket[]
  create: (i: { subject: string; category: TicketCategory; message: string; orderId?: string }) => CreateResult
  reply: (id: string, body: string) => Result
  close: (id: string) => Result
  staffReply: (id: string, body: string, opts?: { internal?: boolean; status?: TicketStatus }) => Result
  staffSetStatus: (id: string, status: TicketStatus) => Result
}

const now = () => new Date().toISOString()
const norm = (e: string) => e.trim().toLowerCase()
const isStaff = () => {
  const u = useAuthStore.getState().user
  return Boolean(u && (u.role === 'admin' || u.role === 'super_admin'))
}

export const useSupportStore = create<State>()(
  persist(
    (set, get) => {
      const find = (id: string) => get().tickets.find((t) => t.id === id)
      const update = (id: string, fn: (t: SupportTicket) => SupportTicket) =>
        set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? { ...fn(t), updatedAt: now() } : t)) }))
      const mineOnly = (id: string) => {
        const u = useAuthStore.getState().user
        const t = find(id)
        return u && t && norm(t.requesterEmail) === norm(u.email) ? t : undefined
      }

      return {
        tickets: [],

        create: ({ subject, category, message, orderId }) => {
          const u = useAuthStore.getState().user
          if (!u) return { ok: false, error: 'Please sign in to contact support.' }

          const sub = subject.trim().replace(/\s+/g, ' ')
          const body = message.trim()
          if (sub.length < LIMITS.subject[0] || sub.length > LIMITS.subject[1]) return { ok: false, error: `Give your request a subject of ${LIMITS.subject[0]} to ${LIMITS.subject[1]} characters.` }
          if (body.length < LIMITS.body[0]) return { ok: false, error: `Please add a few more details (at least ${LIMITS.body[0]} characters).` }
          if (body.length > LIMITS.body[1]) return { ok: false, error: `Please keep your message under ${LIMITS.body[1]} characters.` }

          if (orderId) {
            const order = useOrdersStore.getState().orders.find((o) => o.id === orderId)
            if (!order || norm(order.customerEmail) !== norm(u.email)) return { ok: false, error: 'That order isn’t on your account.' }
          }

          const mine = get().tickets.filter((t) => norm(t.requesterEmail) === norm(u.email))
          const open = mine.filter((t) => t.status === 'open' || t.status === 'pending')
          if (open.length >= LIMITS.maxOpen) return { ok: false, error: `You already have ${LIMITS.maxOpen} open requests. Please wait for a reply or close one first.` }
          if (mine.filter((t) => Date.now() - +new Date(t.createdAt) < 86_400_000).length >= LIMITS.maxPerDay) return { ok: false, error: 'You’ve sent several requests today. Please wait for our replies.' }
          if (open.some((t) => t.subject.toLowerCase() === sub.toLowerCase())) return { ok: false, error: 'You already have an open request with this subject. Reply to it instead.' }

          const ticket: SupportTicket = {
            id: `tkt_${uuid().slice(0, 8)}`,
            number: `SUP-${1001 + get().tickets.length}`,
            requesterEmail: norm(u.email),
            requesterName: u.name,
            subject: sub,
            category,
            orderId,
            status: 'open',
            messages: [{ id: uuid(), from: 'requester', author: u.name, body, at: now() }],
            createdAt: now(),
            updatedAt: now(),
          }
          set((s) => ({ tickets: [ticket, ...s.tickets] }))
          return { ok: true, data: ticket }
        },

        reply: (id, body) => {
          const t = mineOnly(id)
          if (!t) return { ok: false, error: 'Request not found.' }
          if (t.status === 'closed') return { ok: false, error: 'This request is closed. Please start a new one.' }
          const text = body.trim()
          if (text.length < 2 || text.length > LIMITS.body[1]) return { ok: false, error: 'Write a message of up to 2,000 characters.' }
          const u = useAuthStore.getState().user!
          // Replying to a resolved request reopens it.
          update(id, (x) => ({ ...x, status: 'open', messages: [...x.messages, { id: uuid(), from: 'requester', author: u.name, body: text, at: now() }] }))
          return { ok: true }
        },

        close: (id) => {
          const t = mineOnly(id)
          if (!t) return { ok: false, error: 'Request not found.' }
          if (t.status === 'closed') return { ok: true }
          update(id, (x) => ({ ...x, status: 'closed' }))
          return { ok: true }
        },

        staffReply: (id, body, opts) => {
          if (!isStaff()) return { ok: false, error: 'Only Karta staff can reply to support requests.' }
          const t = find(id)
          if (!t) return { ok: false, error: 'Request not found.' }
          const text = body.trim()
          if (text.length < 2 || text.length > LIMITS.body[1]) return { ok: false, error: 'Write a message of up to 2,000 characters.' }
          update(id, (x) => ({
            ...x,
            // Internal notes never change what the customer sees or the status.
            status: opts?.internal ? x.status : opts?.status ?? 'pending',
            messages: [...x.messages, { id: uuid(), from: 'staff', author: 'Karta Support', body: text, at: now(), internal: opts?.internal || undefined }],
          }))
          return { ok: true }
        },

        staffSetStatus: (id, status) => {
          if (!isStaff()) return { ok: false, error: 'Only Karta staff can change a request’s status.' }
          if (!find(id)) return { ok: false, error: 'Request not found.' }
          update(id, (x) => ({ ...x, status }))
          return { ok: true }
        },
      }
    },
    { name: 'karta-support', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

/** What the requester is allowed to see: staff-only notes are removed. */
export const visibleMessages = (t: SupportTicket, viewer: 'requester' | 'staff') =>
  viewer === 'staff' ? t.messages : t.messages.filter((m) => !m.internal)

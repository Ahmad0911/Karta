import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { uuid } from '@/lib/id'
import { safeStorage } from '@/lib/safeStorage'
import { useAuthStore } from '@/store/auth.store'
import { vendorIdFor } from '@/modules/catalog/vendorId'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import type { VendorListing } from '@/modules/vendors/types'
import { CONTACT_MESSAGE, LIMITS, containsContactInfo } from './lib'
import type { CustomRequest, RequestEvent } from './types'

/* -------------------------------------------------------------------------- */
/* Custom requests (MOCK of the requests service)                             */
/* -------------------------------------------------------------------------- */
/**
 * "First vendor to claim it wins" is decided inside ONE state update, so two
 * vendors can never both get it. On a real server this must be an atomic
 * database operation (a conditional UPDATE ... WHERE status = 'open', or a
 * unique constraint), because two requests can arrive at the same moment.
 */

type Result = { ok: true } | { ok: false; error: string }
type CreateResult = { ok: true; data: CustomRequest } | { ok: false; error: string }

export interface NewRequestInput {
  title: string
  description: string
  categoryId?: string
  room?: string
  styles: string[]
  dimensions?: string
  budgetMin?: number
  budgetMax?: number
  neededWithinDays?: number
  city: string
  state: string
  images: string[]
}

interface State {
  requests: CustomRequest[]

  create: (input: NewRequestInput) => CreateResult
  close: (id: string) => Result
  offer: (id: string, o: { price: number; days: number; note: string }) => Result
  withdraw: (id: string) => Result
  respond: (id: string, decision: 'accept' | 'decline') => Result
  adminRemove: (id: string, reason: string) => Result

  /** Reopens timed-out offers and closes lapsed requests. Safe to call often. */
  sweep: () => void
  /** Called when a paid order contains a custom piece. */
  markOrdered: (listingId: string) => void
}

const now = () => new Date().toISOString()
const addMs = (ms: number) => new Date(Date.now() + ms).toISOString()
const norm = (e: string) => e.trim().toLowerCase()
const DAY = 86_400_000
const HOUR = 3_600_000
const isStaff = () => {
  const u = useAuthStore.getState().user
  return Boolean(u && (u.role === 'admin' || u.role === 'super_admin'))
}
const ev = (by: RequestEvent['by'], action: string, note?: string): RequestEvent => ({ id: uuid(), at: now(), by, action, note: note?.trim() || undefined })
const ACTIVE = ['open', 'claimed', 'accepted'] as const

export const useRequestsStore = create<State>()(
  persist(
    (set, get) => {
      const find = (id: string) => get().requests.find((r) => r.id === id)
      const patch = (id: string, fn: (r: CustomRequest) => CustomRequest) =>
        set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...fn(r), updatedAt: now() } : r)) }))
      const mine = (id: string) => {
        const u = useAuthStore.getState().user
        const r = find(id)
        return u && r && norm(r.customerEmail) === norm(u.email) ? r : undefined
      }

      return {
        requests: [],

        create: (i) => {
          const u = useAuthStore.getState().user
          if (!u) return { ok: false, error: 'Please sign in to make a request.' }
          if (!u.phoneVerified) return { ok: false, error: 'Please verify your phone number first. Vendors need to be able to trust who is asking.' }

          const title = i.title.trim().replace(/\s+/g, ' ')
          const description = i.description.trim()
          if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) return { ok: false, error: `Give your request a title of ${LIMITS.title[0]} to ${LIMITS.title[1]} characters.` }
          if (description.length < LIMITS.description[0]) return { ok: false, error: `Describe it in a little more detail (at least ${LIMITS.description[0]} characters).` }
          if (description.length > LIMITS.description[1]) return { ok: false, error: `Please keep the description under ${LIMITS.description[1]} characters.` }
          if (containsContactInfo(title) || containsContactInfo(description) || containsContactInfo(i.dimensions ?? '')) return { ok: false, error: CONTACT_MESSAGE }

          if (!i.state || i.city.trim().length < 2) return { ok: false, error: 'Tell vendors where it should be delivered (city and state).' }
          if (i.images.length > LIMITS.maxImages) return { ok: false, error: `You can add up to ${LIMITS.maxImages} images.` }

          const { budgetMin: lo, budgetMax: hi } = i
          for (const b of [lo, hi]) if (b !== undefined && (!Number.isInteger(b) || b < 1000)) return { ok: false, error: 'Budgets must be whole naira amounts of at least ₦1,000.' }
          if (lo !== undefined && hi !== undefined && hi < lo) return { ok: false, error: 'Your maximum budget can’t be lower than the minimum.' }

          const email = norm(u.email)
          const all = get().requests.filter((r) => r.customerEmail === email)
          if (all.filter((r) => (ACTIVE as readonly string[]).includes(r.status)).length >= LIMITS.maxActive) return { ok: false, error: `You can have ${LIMITS.maxActive} active requests at a time. Close one to make another.` }
          if (all.filter((r) => Date.now() - +new Date(r.createdAt) < DAY).length >= LIMITS.maxPerDay) return { ok: false, error: 'You’ve made several requests today. Please try again tomorrow.' }

          const [first, ...rest] = u.name.trim().split(/\s+/)
          const req: CustomRequest = {
            id: `req_${uuid().slice(0, 8)}`,
            number: `REQ-${1001 + get().requests.length}`,
            customerEmail: email,
            customerLabel: rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first,
            city: i.city.trim(),
            state: i.state,
            title,
            description,
            categoryId: i.categoryId || undefined,
            room: i.room || undefined,
            styles: i.styles,
            dimensions: i.dimensions?.trim() || undefined,
            budgetMin: lo,
            budgetMax: hi,
            neededWithinDays: i.neededWithinDays,
            images: i.images,
            status: 'open',
            declinedBy: [],
            events: [ev('customer', 'Request posted')],
            createdAt: now(),
            updatedAt: now(),
            expiresAt: addMs(LIMITS.openDays * DAY),
          }
          set((s) => ({ requests: [req, ...s.requests] }))
          return { ok: true, data: req }
        },

        close: (id) => {
          const r = mine(id)
          if (!r) return { ok: false, error: 'Request not found.' }
          if (r.status === 'ordered' || r.status === 'closed' || r.status === 'removed') return { ok: false, error: 'This request can no longer be closed.' }
          if (r.offer?.listingId) useVendorStore.getState().retireCustomListing(r.offer.vendorEmail, r.offer.listingId)
          patch(id, (x) => ({ ...x, status: 'closed', events: [...x.events, ev('customer', 'Closed by customer')] }))
          return { ok: true }
        },

        offer: (id, { price, days, note }) => {
          const u = useAuthStore.getState().user
          if (!u || u.role !== 'vendor') return { ok: false, error: 'Only vendors can make offers.' }

          const email = norm(u.email)
          const workspace = useVendorStore.getState().byEmail[email]
          if (workspace?.profile.status !== 'approved') return { ok: false, error: 'Your vendor account must be verified before you can make offers.' }

          if (!Number.isInteger(price) || price < LIMITS.price[0] || price > LIMITS.price[1]) return { ok: false, error: 'Enter a price in whole naira (at least ₦1,000).' }
          if (!Number.isInteger(days) || days < LIMITS.days[0] || days > LIMITS.days[1]) return { ok: false, error: `Enter how many days you need (${LIMITS.days[0]} to ${LIMITS.days[1]}).` }
          const text = note.trim()
          if (text.length < LIMITS.note[0] || text.length > LIMITS.note[1]) return { ok: false, error: `Add a note for the customer (${LIMITS.note[0]} to ${LIMITS.note[1]} characters).` }
          if (containsContactInfo(text)) return { ok: false, error: CONTACT_MESSAGE }

          const held = get().requests.filter((r) => r.status === 'claimed' && r.offer?.vendorEmail === email).length
          if (held >= LIMITS.maxHeldOffers) return { ok: false, error: `You already have ${LIMITS.maxHeldOffers} offers waiting for an answer. Wait for a response first.` }

          // ---- the atomic part: check and claim inside ONE update ----
          let outcome: Result = { ok: false, error: 'Request not found.' }
          set((s) => ({
            requests: s.requests.map((r) => {
              if (r.id !== id) return r
              if (norm(r.customerEmail) === email) { outcome = { ok: false, error: 'You can’t make an offer on your own request.' }; return r }
              if (r.status !== 'open') { outcome = { ok: false, error: 'Another vendor has already taken this request.' }; return r }
              if (r.declinedBy.includes(email)) { outcome = { ok: false, error: 'Your earlier offer on this request wasn’t taken, so you can’t claim it again.' }; return r }

              outcome = { ok: true }
              return {
                ...r,
                status: 'claimed' as const,
                offer: { vendorEmail: email, vendorId: vendorIdFor(email), vendorName: workspace.profile.business.name, price, days, note: text, at: now(), expiresAt: addMs(LIMITS.offerHours * HOUR) },
                events: [...r.events, ev('vendor', 'Offer made', `₦${price.toLocaleString('en-NG')} · ${days} days`)],
                updatedAt: now(),
              }
            }),
          }))
          return outcome
        },

        withdraw: (id) => {
          const u = useAuthStore.getState().user
          const r = find(id)
          if (!u || !r?.offer || norm(r.offer.vendorEmail) !== norm(u.email)) return { ok: false, error: 'Offer not found.' }
          if (r.status !== 'claimed') return { ok: false, error: 'This offer can no longer be withdrawn.' }
          patch(id, (x) => ({ ...x, status: 'open', offer: undefined, declinedBy: [...x.declinedBy, norm(u.email)], events: [...x.events, ev('vendor', 'Offer withdrawn')] }))
          return { ok: true }
        },

        respond: (id, decision) => {
          const r = mine(id)
          if (!r) return { ok: false, error: 'Request not found.' }
          if (r.status !== 'claimed' || !r.offer) return { ok: false, error: 'There is no offer to answer.' }

          if (new Date(r.offer.expiresAt).getTime() < Date.now()) {
            get().sweep()
            return { ok: false, error: 'This offer has expired and the request is open again.' }
          }

          if (decision === 'decline') {
            patch(id, (x) => ({ ...x, status: 'open', offer: undefined, declinedBy: [...x.declinedBy, x.offer!.vendorEmail], events: [...x.events, ev('customer', 'Offer declined')] }))
            return { ok: true }
          }

          // Accepting creates a piece only this customer can see and buy.
          const o = r.offer
          const listing: VendorListing = {
            id: `lst_c_${uuid().slice(0, 8)}`,
            sku: `KRT-CUSTOM-${r.number.slice(4)}`,
            name: `Custom: ${r.title}`,
            categoryId: r.categoryId ?? '',
            room: r.room ?? '',
            description: `${r.description}\n\nVendor’s note: ${o.note}`,
            material: 'Made to order',
            dimensions: r.dimensions ?? 'As agreed',
            colors: [],
            price: o.price,
            stock: 1,
            deliveryMinDays: o.days,
            deliveryMaxDays: o.days,
            assemblyAvailable: false,
            images: r.images,
            status: 'live',
            custom: { requestId: r.id, customerEmail: r.customerEmail },
            createdAt: now(),
            updatedAt: now(),
          }
          useVendorStore.getState().addCustomListing(o.vendorEmail, listing)
          patch(id, (x) => ({ ...x, status: 'accepted', expiresAt: addMs(LIMITS.acceptedDays * DAY), offer: { ...x.offer!, listingId: listing.id }, events: [...x.events, ev('customer', 'Offer accepted')] }))
          return { ok: true }
        },

        adminRemove: (id, reason) => {
          if (!isStaff()) return { ok: false, error: 'Only Karta staff can remove requests.' }
          const r = find(id)
          if (!r) return { ok: false, error: 'Request not found.' }
          if (r.status === 'ordered') return { ok: false, error: 'This request already has a paid order.' }
          if (reason.trim().length < 10) return { ok: false, error: 'Record why it is being removed (at least 10 characters).' }
          if (r.offer?.listingId) useVendorStore.getState().retireCustomListing(r.offer.vendorEmail, r.offer.listingId)
          patch(id, (x) => ({ ...x, status: 'removed', removedReason: reason.trim(), events: [...x.events, ev('admin', 'Removed', reason)] }))
          return { ok: true }
        },

        sweep: () => {
          const t = Date.now()
          const changed = get().requests.some(
            (r) => (r.status === 'claimed' && r.offer && +new Date(r.offer.expiresAt) < t) || (['open', 'accepted'].includes(r.status) && +new Date(r.expiresAt) < t),
          )
          if (!changed) return

          set((s) => ({
            requests: s.requests.map((r) => {
              if (r.status === 'claimed' && r.offer && +new Date(r.offer.expiresAt) < t) {
                return { ...r, status: 'open' as const, offer: undefined, declinedBy: [...r.declinedBy, r.offer.vendorEmail], events: [...r.events, ev('system', 'Offer timed out', 'The customer didn’t answer in time, so the request is open again.')], updatedAt: now() }
              }
              if (['open', 'accepted'].includes(r.status) && +new Date(r.expiresAt) < t) {
                if (r.offer?.listingId) useVendorStore.getState().retireCustomListing(r.offer.vendorEmail, r.offer.listingId)
                return { ...r, status: 'closed' as const, events: [...r.events, ev('system', 'Expired')], updatedAt: now() }
              }
              return r
            }),
          }))
        },

        markOrdered: (listingId) =>
          set((s) => ({
            requests: s.requests.map((r) =>
              r.status === 'accepted' && r.offer?.listingId === listingId
                ? { ...r, status: 'ordered' as const, events: [...r.events, ev('system', 'Paid. The vendor will start making it.')], updatedAt: now() }
                : r,
            ),
          })),
      }
    },
    { name: 'karta-requests', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

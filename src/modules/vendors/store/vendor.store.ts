import { uuid } from '@/lib/id'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { safeStorage } from '@/lib/safeStorage'
import { samePhone } from '@/lib/phone'
import { useAuthStore } from '@/store/auth.store'
import type { User } from '@/types'

import { VENDOR_POLICY } from '../config'
import { makeSku, validateListing, type ListingDraft } from '../lib/listings'
import { commissionFor } from '../lib/finance'
import {
  createEmptyProfile,
  firstIncompleteStep,
} from '../lib/onboarding'
import { VENDOR_NEXT_ACTION, canVendorCancel } from '../lib/orders'
import { buildDemoData } from './demo'
import type {
  ListingStatus,
  VendorListing,
  VendorOrder,
  VendorProfile,
  VendorWorkspace,
  VerificationAction,
} from '../types'

/* -------------------------------------------------------------------------- */
/* Karta vendor workspace (MOCK)                                              */
/* -------------------------------------------------------------------------- */
/**
 * Everything a vendor owns, keyed by account email.
 *
 * MOCK: replace each action with an API call (BRD §13). Status changes such
 * as approval, moderation and delivery are decided by the server; the DEV
 * helpers at the bottom exist only so the flow can be tried without one.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string }

export type ApplicationDecision =
  | 'approve'
  | 'request_changes'
  | 'reject'
  | 'suspend'
  | 'reinstate'

interface VendorState {
  byEmail: Record<string, VendorWorkspace>

  /* Workspace */
  ensureWorkspace: (user: User) => void

  /* Onboarding */
  updateProfile: (email: string, updater: (p: VendorProfile) => VendorProfile) => void
  submitApplication: (email: string) => ActionResult

  /* Listings */
  saveListing: (
    email: string,
    input: { id?: string; draft: ListingDraft; submitForReview: boolean },
  ) => ActionResult<VendorListing>
  setListingStatus: (email: string, id: string, status: ListingStatus) => ActionResult
  setListingStock: (email: string, id: string, stock: number) => ActionResult
  deleteListing: (email: string, id: string) => void

  /* Orders */
  advanceOrder: (email: string, orderId: string) => ActionResult
  cancelOrder: (email: string, orderId: string, reason: string) => ActionResult

  /* Platform → vendor (done by the server in production) */
  addCustomListing: (vendorEmail: string, listing: VendorListing) => void
  retireCustomListing: (vendorEmail: string, listingId: string) => void
  receiveOrder: (vendorEmail: string, order: VendorOrder) => void
  devMarkOrderDelivered: (vendorEmail: string, orderId: string) => void
  /** A refund was issued for returned items: shrink this order's earnings. */
  adjustForRefund: (vendorEmail: string, orderId: string, itemsRefunded: number) => void

  /* Admin (platform staff only) */
  decideApplication: (
    vendorEmail: string,
    decision: ApplicationDecision,
    note: string,
    trustScore?: number,
  ) => ActionResult
  moderateListing: (
    vendorEmail: string,
    listingId: string,
    decision: 'approve' | 'reject',
    note: string,
  ) => ActionResult

  /* DEV-only mock controls */
  devLoadDemoData: (email: string) => void
  devReset: (email: string) => void
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const now = () => new Date().toISOString()
const uid = (prefix: string) => `${prefix}_${uuid().slice(0, 8)}`
const key = (email: string) => email.trim().toLowerCase()

/**
 * Defence-in-depth for the mock: admin actions refuse to run unless the
 * signed-in account is staff. The REAL check must happen on the server, on
 * every request, because anything in the browser can be bypassed.
 */
const currentAdmin = (): string | null => {
  const u = useAuthStore.getState().user
  return u && (u.role === 'admin' || u.role === 'super_admin') ? u.email : null
}

const DECISION_RULES: Record<
  ApplicationDecision,
  {
    from: VendorProfile['status'][]
    to: VendorProfile['status']
    action: VerificationAction
    needsNote: boolean
  }
> = {
  approve: { from: ['under_review'], to: 'approved', action: 'approved', needsNote: false },
  request_changes: { from: ['under_review'], to: 'changes_requested', action: 'changes_requested', needsNote: true },
  reject: { from: ['under_review', 'changes_requested'], to: 'rejected', action: 'rejected', needsNote: true },
  suspend: { from: ['approved'], to: 'suspended', action: 'suspended', needsNote: true },
  reinstate: { from: ['suspended'], to: 'approved', action: 'reinstated', needsNote: false },
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useVendorStore = create<VendorState>()(
  persist(
    (set, get) => {
      /** Apply `fn` to one workspace. No-op if it does not exist. */
      const mutate = (
        email: string,
        fn: (w: VendorWorkspace) => VendorWorkspace,
      ) =>
        set((state) => {
          const k = key(email)
          const current = state.byEmail[k]
          if (!current) return state
          return { byEmail: { ...state.byEmail, [k]: fn(current) } }
        })

      const read = (email: string) => get().byEmail[key(email)]

      return {
        byEmail: {},

        /* ------------------------------ Workspace ------------------------------ */

        ensureWorkspace: (user) => {
          const k = key(user.email)
          if (get().byEmail[k]) return

          set((state) => ({
            byEmail: {
              ...state.byEmail,
              [k]: {
                profile: createEmptyProfile(user),
                listings: [],
                orders: [],
                payouts: [],
              },
            },
          }))
        },

        /* ------------------------------ Onboarding ----------------------------- */

        updateProfile: (email, updater) =>
          mutate(email, (w) => ({ ...w, profile: updater(w.profile) })),

        submitApplication: (email) => {
          const w = read(email)
          if (!w) return { ok: false, error: 'Account not found.' }

          if (
            w.profile.status !== 'draft' &&
            w.profile.status !== 'changes_requested'
          ) {
            return { ok: false, error: 'This application has already been submitted.' }
          }

          if (firstIncompleteStep(w.profile) !== -1) {
            return { ok: false, error: 'Some sections still need your attention.' }
          }

          // Contact details must be ones the applicant has proven they own.
          const account = useAuthStore.getState().accounts[key(email)]?.user
          if (!account?.emailVerified || !account?.phoneVerified) {
            return { ok: false, error: 'Verify your email and phone number before submitting.' }
          }
          if (key(w.profile.contact.email) !== key(account.email) || !samePhone(w.profile.contact.phone, account.phone ?? '')) {
            return { ok: false, error: 'Use the email and phone number you verified, or verify the new ones in Settings.' }
          }

          mutate(email, (x) => ({
            ...x,
            profile: {
              ...x.profile,
              status: 'under_review',
              reviewNote: undefined,
              submittedAt: now(),
              verificationLog: [
                ...(x.profile.verificationLog ?? []),
                { id: uid('log'), at: now(), by: key(email), action: 'submitted' },
              ],
            },
          }))

          return { ok: true }
        },

        /* ------------------------------- Listings ------------------------------ */

        saveListing: (email, { id, draft, submitForReview }) => {
          const w = read(email)
          if (!w) return { ok: false, error: 'Account not found.' }

          const errors = validateListing(draft, submitForReview ? 'submit' : 'draft')
          if (Object.keys(errors).length > 0) {
            return { ok: false, error: 'Please fix the highlighted fields.' }
          }

          if (submitForReview && w.profile.status !== 'approved') {
            return {
              ok: false,
              error: 'You can submit listings once your vendor application is approved.',
            }
          }

          if (draft.images.length > VENDOR_POLICY.maxImages) {
            return { ok: false, error: `Use at most ${VENDOR_POLICY.maxImages} photos.` }
          }

          const existing = id ? w.listings.find((l) => l.id === id) : undefined
          if (id && !existing) return { ok: false, error: 'Listing not found.' }
          if (existing?.custom) return { ok: false, error: 'This piece was agreed with a customer, so its details can’t be changed.' }

          const timestamp = now()

          let nextStatus: ListingStatus = existing?.status ?? 'draft'
          if (submitForReview) {
            // A live or paused listing keeps its status when edited.
            nextStatus =
              existing?.status === 'live' || existing?.status === 'paused'
                ? existing.status
                : 'in_review'
          } else if (!existing) {
            nextStatus = 'draft'
          }

          const listing: VendorListing = existing
            ? {
                ...existing,
                ...draft,
                name: draft.name.trim(),
                status: nextStatus,
                moderationNote: submitForReview ? undefined : existing.moderationNote,
                updatedAt: timestamp,
              }
            : {
                ...draft,
                name: draft.name.trim(),
                id: uid('lst'),
                sku: makeSku(draft.name, w.listings.map((l) => l.sku)),
                status: nextStatus,
                createdAt: timestamp,
                updatedAt: timestamp,
              }

          mutate(email, (x) => ({
            ...x,
            listings: existing
              ? x.listings.map((l) => (l.id === listing.id ? listing : l))
              : [listing, ...x.listings],
          }))

          return { ok: true, data: listing }
        },

        setListingStatus: (email, id, status) => {
          const w = read(email)
          const listing = w?.listings.find((l) => l.id === id)
          if (!w || !listing) return { ok: false, error: 'Listing not found.' }

          const allowed =
            (listing.status === 'live' && status === 'paused') ||
            (listing.status === 'paused' && status === 'live') ||
            (listing.status === 'in_review' && status === 'draft')

          if (!allowed) {
            return { ok: false, error: 'That change isn’t available for this listing.' }
          }

          mutate(email, (x) => ({
            ...x,
            listings: x.listings.map((l) =>
              l.id === id ? { ...l, status, updatedAt: now() } : l,
            ),
          }))

          return { ok: true }
        },

        setListingStock: (email, id, stock) => {
          if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
            return { ok: false, error: 'Stock must be a whole number from 0 upward.' }
          }

          mutate(email, (x) => ({
            ...x,
            listings: x.listings.map((l) =>
              l.id === id ? { ...l, stock, updatedAt: now() } : l,
            ),
          }))

          return { ok: true }
        },

        deleteListing: (email, id) =>
          mutate(email, (x) => ({
            ...x,
            listings: x.listings.filter(
              // Only drafts and paused listings can be removed.
              (l) => l.id !== id || (l.status !== 'draft' && l.status !== 'paused'),
            ),
          })),

        /* -------------------------------- Orders ------------------------------- */

        advanceOrder: (email, orderId) => {
          const order = read(email)?.orders.find((o) => o.id === orderId)
          if (!order) return { ok: false, error: 'Order not found.' }

          const step = VENDOR_NEXT_ACTION[order.status]
          if (!step) return { ok: false, error: 'No further action is needed from you.' }

          mutate(email, (x) => ({
            ...x,
            orders: x.orders.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    status: step.to,
                    events: [...o.events, { status: step.to, at: now() }],
                  }
                : o,
            ),
          }))

          return { ok: true }
        },

        cancelOrder: (email, orderId, reason) => {
          const order = read(email)?.orders.find((o) => o.id === orderId)
          if (!order) return { ok: false, error: 'Order not found.' }

          if (!canVendorCancel(order.status)) {
            return { ok: false, error: 'This order can no longer be cancelled by the vendor.' }
          }

          const trimmed = reason.trim()
          if (trimmed.length < 5) {
            return { ok: false, error: 'Tell the customer why (at least 5 characters).' }
          }

          mutate(email, (x) => ({
            ...x,
            orders: x.orders.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    status: 'cancelled',
                    cancelReason: trimmed,
                    events: [
                      ...o.events,
                      { status: 'cancelled', at: now(), note: trimmed },
                    ],
                  }
                : o,
            ),
          }))

          return { ok: true }
        },

        /* ---------------------------- DEV mock controls ------------------------- */

        /* ------------------------- Platform → vendor ---------------------------- */

        addCustomListing: (vendorEmail, listing) =>
          mutate(vendorEmail, (x) =>
            x.listings.some((l) => l.id === listing.id) ? x : { ...x, listings: [listing, ...x.listings] },
          ),

        retireCustomListing: (vendorEmail, listingId) =>
          mutate(vendorEmail, (x) => ({
            ...x,
            listings: x.listings.map((l) => (l.id === listingId && l.custom ? { ...l, status: 'paused', stock: 0, updatedAt: now() } : l)),
          })),

        receiveOrder: (vendorEmail, order) =>
          mutate(vendorEmail, (x) => {
            // Idempotent: a retried webhook must never create a duplicate order.
            if (x.orders.some((o) => o.id === order.id)) return x

            const sold = new Map(order.lines.map((l) => [l.listingId, l.qty]))

            return {
              ...x,
              orders: [order, ...x.orders],
              listings: x.listings.map((l) =>
                sold.has(l.id)
                  ? { ...l, stock: Math.max(0, l.stock - (sold.get(l.id) ?? 0)), updatedAt: now() }
                  : l,
              ),
            }
          }),

        adjustForRefund: (vendorEmail, orderId, itemsRefunded) =>
          mutate(vendorEmail, (x) => ({
            ...x,
            orders: x.orders.map((o) => {
              if (o.id !== orderId) return o
              const refundedItems = Math.min(o.subtotal, (o.refundedItems ?? 0) + itemsRefunded)
              const remaining = o.subtotal - refundedItems
              const commission = commissionFor(remaining)
              const netEarning = remaining - commission
              const lost = o.netEarning - netEarning
              return {
                ...o,
                refundedItems,
                commission,
                netEarning,
                // Already paid out? Then Karta must recover the difference.
                clawback: o.payoutId ? (o.clawback ?? 0) + lost : o.clawback,
              }
            }),
          })),

        devMarkOrderDelivered: (vendorEmail, orderId) =>
          mutate(vendorEmail, (x) => ({
            ...x,
            orders: x.orders.map((o) =>
              o.id === orderId && o.status !== 'delivered' && o.status !== 'cancelled'
                ? {
                    ...o,
                    status: 'delivered',
                    deliveredAt: now(),
                    events: [...o.events, { status: 'delivered', at: now() }],
                  }
                : o,
            ),
          })),

        /* --------------------------------- Admin -------------------------------- */

        decideApplication: (vendorEmail, decision, note, trustScore) => {
          const admin = currentAdmin()
          if (!admin) return { ok: false, error: 'Only Karta staff can review applications.' }

          const w = read(vendorEmail)
          if (!w) return { ok: false, error: 'Vendor not found.' }

          const rule = DECISION_RULES[decision]
          if (!rule.from.includes(w.profile.status)) {
            return { ok: false, error: 'That decision isn’t available for this vendor’s current status.' }
          }

          const trimmed = note.trim()
          if (rule.needsNote && trimmed.length < 10) {
            return { ok: false, error: 'Add a clear note (at least 10 characters). The vendor will see it.' }
          }

          if (decision === 'approve') {
            // Never approve an incomplete application, even if the UI allowed it.
            if (firstIncompleteStep(w.profile) !== -1) {
              return { ok: false, error: 'This application is incomplete and cannot be approved.' }
            }
            if (trustScore !== undefined && (!Number.isFinite(trustScore) || trustScore < 0 || trustScore > 100)) {
              return { ok: false, error: 'Starting trust score must be between 0 and 100.' }
            }
          }

          mutate(vendorEmail, (x) => ({
            ...x,
            profile: {
              ...x.profile,
              status: rule.to,
              reviewNote:
                decision === 'approve' || decision === 'reinstate' ? undefined : trimmed || undefined,
              approvedAt: decision === 'approve' ? now() : x.profile.approvedAt,
              trustScore:
                decision === 'approve' ? Math.round(trustScore ?? 60) : x.profile.trustScore,
              verificationLog: [
                ...(x.profile.verificationLog ?? []),
                { id: uid('log'), at: now(), by: admin, action: rule.action, note: trimmed || undefined },
              ],
            },
          }))

          return { ok: true }
        },

        moderateListing: (vendorEmail, listingId, decision, note) => {
          if (!currentAdmin()) return { ok: false, error: 'Only Karta staff can moderate listings.' }

          const w = read(vendorEmail)
          const listing = w?.listings.find((l) => l.id === listingId)
          if (!w || !listing) return { ok: false, error: 'Listing not found.' }

          if (listing.status !== 'in_review') {
            return { ok: false, error: 'This listing isn’t waiting for review.' }
          }

          if (w.profile.status !== 'approved') {
            return { ok: false, error: 'Only listings from approved vendors can go live.' }
          }

          const trimmed = note.trim()
          if (decision === 'reject' && trimmed.length < 10) {
            return { ok: false, error: 'Explain what needs fixing (at least 10 characters).' }
          }

          mutate(vendorEmail, (x) => ({
            ...x,
            listings: x.listings.map((l) =>
              l.id === listingId
                ? decision === 'approve'
                  ? { ...l, status: 'live', moderationNote: undefined, updatedAt: now() }
                  : { ...l, status: 'draft', moderationNote: trimmed, updatedAt: now() }
                : l,
            ),
          }))

          return { ok: true }
        },

        /* ---------------------------- DEV mock controls ------------------------- */

        devLoadDemoData: (email) =>
          mutate(email, (w) => {
            const demo = buildDemoData(commissionFor)
            return {
              ...w,
              profile: {
                ...w.profile,
                status: 'approved',
                approvedAt: w.profile.approvedAt ?? now(),
                trustScore: w.profile.trustScore || 82,
                verificationLog: [
                  ...(w.profile.verificationLog ?? []),
                  { id: uid('log'), at: now(), by: 'dev-sample-data', action: 'approved' },
                ],
              },
              listings: [...demo.listings, ...w.listings.filter((l) => !l.id.startsWith('demo_'))],
              orders: demo.orders,
              payouts: demo.payouts,
            }
          }),

        devReset: (email) =>
          set((state) => {
            const rest = { ...state.byEmail }
            delete rest[key(email)]
            return { byEmail: rest }
          }),
      }
    },
    {
      name: 'karta-vendor',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
)

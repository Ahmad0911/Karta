import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import { errorText } from '@/store/auth.api'
import type { User } from '@/types'

import { createEmptyProfile } from '../lib/onboarding'
import type { ListingDraft } from '../lib/listings'
import type { ListingStatus, OrderStatus, VendorListing, VendorOrder, VendorPayout, VendorProfile, VendorWorkspace } from '../types'

/**
 * The vendor workspace from the Karta API (production builds).
 * The server is the single source of truth: every change goes to it first, and the screens then show what it
 * actually stored. Nothing here can approve a vendor, publish a listing or move an order outside the server's rules.
 */

export type Result<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string }

/* ------------------------------- mapping -------------------------------- */

interface ApiApplication {
  status: VendorProfile['status']
  business: VendorProfile['business']
  contact: VendorProfile['contact']
  payout: VendorProfile['payout']
  agreedToTerms: boolean
  trustScore: number
  reviewNote: string | null
  submittedAt: string | null
  decidedAt: string | null
  documents: { id: string; kind: VendorProfile['documents'][number]['kind']; fileName: string; sizeKb: number; uploadedAt: string }[]
}

export const toProfile = (a: ApiApplication, prev?: VendorProfile): VendorProfile => ({
  status: a.status,
  reviewNote: a.reviewNote ?? undefined,
  submittedAt: a.submittedAt ?? undefined,
  approvedAt: a.status === 'approved' ? a.decidedAt ?? undefined : undefined,
  trustScore: a.trustScore,
  verificationLog: prev?.verificationLog ?? [],
  onboardingStep: prev?.onboardingStep ?? 0,
  business: a.business,
  contact: a.contact,
  documents: a.documents.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName, sizeKb: d.sizeKb, uploadedAt: d.uploadedAt })),
  payout: a.payout,
  agreedToTerms: a.agreedToTerms,
})

interface ApiListing {
  id: string; sku: string | null; name: string; categoryId: string; room: string; description: string; material: string; dimensions: string
  colors: VendorListing['colors']; priceKobo: number; originalPriceKobo: number | null; stock: number; deliveryMinDays: number; deliveryMaxDays: number
  assemblyAvailable: boolean; images: string[]; status: ListingStatus; moderationNote: string | null; createdAt: string | null; updatedAt: string
}
export const toListing = (l: ApiListing): VendorListing => ({
  id: l.id, sku: l.sku ?? '', name: l.name, categoryId: l.categoryId, room: l.room, description: l.description, material: l.material, dimensions: l.dimensions,
  colors: l.colors, price: Math.round(l.priceKobo / 100), originalPrice: l.originalPriceKobo ? Math.round(l.originalPriceKobo / 100) : undefined,
  stock: l.stock, deliveryMinDays: l.deliveryMinDays, deliveryMaxDays: l.deliveryMaxDays, assemblyAvailable: l.assemblyAvailable, images: l.images,
  status: l.status, moderationNote: l.moderationNote ?? undefined, createdAt: l.createdAt ?? l.updatedAt, updatedAt: l.updatedAt,
})

interface ApiVendorOrder {
  id: string; number: string; customerLabel: string; city: string; state: string
  lines: { listingId: string; name: string; unitPriceKobo: number; qty: number }[]
  subtotalKobo: number; commissionKobo: number; netEarningKobo: number; status: OrderStatus; placedAt: string; deliveredAt: string | null; cancelReason: string | null
  events: { status: OrderStatus; at: string; note: string | null }[]
  payoutId?: string | null
}
export const toOrder = (o: ApiVendorOrder): VendorOrder => ({
  id: o.id, number: o.number, customerLabel: o.customerLabel, city: o.city, state: o.state,
  lines: o.lines.map((l) => ({ listingId: l.listingId, name: l.name, qty: l.qty, unitPrice: Math.round(l.unitPriceKobo / 100), assembly: false })),
  subtotal: Math.round(o.subtotalKobo / 100), commission: Math.round(o.commissionKobo / 100), netEarning: Math.round(o.netEarningKobo / 100),
  status: o.status, placedAt: o.placedAt, deliveredAt: o.deliveredAt ?? undefined, cancelReason: o.cancelReason ?? undefined, payoutId: o.payoutId ?? undefined,
  events: o.events.map((e) => ({ status: e.status, at: e.at, note: e.note ?? undefined })),
})

/* ------------------------------- loading -------------------------------- */

type Put = (email: string, updater: (w: VendorWorkspace | undefined) => VendorWorkspace) => void

/** Replace a vendor's workspace with what the server says. `put` is the store's setter. */
export async function loadWorkspace(user: User, current: VendorWorkspace | undefined, put: Put): Promise<void> {
  const [app, listings, orders, payouts] = await Promise.all([
    apiGet<{ application: ApiApplication }>('/vendor/application'),
    apiGet<{ listings: ApiListing[] }>('/vendor/listings'),
    apiGet<{ orders: ApiVendorOrder[] }>('/vendor/orders'),
    apiGet<{ payouts: { id: string; reference: string; amountKobo: number; orderIds: string[]; paidAt: string | null; bankLabel: string }[] }>('/vendor/payouts'),
  ])
  put(user.email, (w) => ({
    profile: toProfile(app.application, w?.profile ?? current?.profile ?? createEmptyProfile(user)),
    listings: listings.listings.map(toListing),
    orders: orders.orders.map(toOrder),
    payouts: payouts.payouts.map((p): VendorPayout => ({ id: p.id, reference: p.reference, amount: Math.round(p.amountKobo / 100), orderIds: p.orderIds, paidAt: p.paidAt ?? '', bankLabel: p.bankLabel })),
  }))
}

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: errorText(e) })

/* ------------------------------- listings ------------------------------- */

const kobo = (naira: number) => Math.round(naira * 100)

/** Create-or-update, then (optionally) send for review. Returns the listing exactly as the server stored it. */
export async function saveListingRemote(id: string | undefined, draft: ListingDraft, submitForReview: boolean): Promise<Result<VendorListing>> {
  try {
    const listingId = id ?? (await apiPost<ApiListing>('/vendor/listings', { name: draft.name.trim() })).id
    const body: Record<string, unknown> = {
      name: draft.name.trim(), categoryId: draft.categoryId, room: draft.room, description: draft.description, material: draft.material,
      dimensions: draft.dimensions, colors: draft.colors, priceKobo: Math.max(100, kobo(draft.price)), stock: draft.stock,
      deliveryMinDays: draft.deliveryMinDays, deliveryMaxDays: draft.deliveryMaxDays, assemblyAvailable: draft.assemblyAvailable, images: draft.images,
    }
    if (draft.originalPrice) body.originalPriceKobo = kobo(draft.originalPrice)
    let saved = await apiPut<ApiListing>(`/vendor/listings/${listingId}`, body)
    if (submitForReview && saved.status === 'draft') saved = await apiPost<ApiListing>(`/vendor/listings/${listingId}/submit`)
    return { ok: true, data: toListing(saved) }
  } catch (e) {
    return fail(e)
  }
}

export async function setListingStatusRemote(id: string, status: ListingStatus, current: ListingStatus): Promise<Result> {
  try {
    if (current === 'live' && status === 'paused') await apiPost(`/vendor/listings/${id}/pause`)
    else if (current === 'paused' && status === 'live') await apiPost(`/vendor/listings/${id}/resume`)
    else return { ok: false, error: 'That change isn’t available for this listing.' }
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function setListingStockRemote(id: string, stock: number): Promise<Result> {
  try { await apiPut(`/vendor/listings/${id}`, { stock }); return { ok: true } } catch (e) { return fail(e) }
}

export async function deleteListingRemote(id: string): Promise<Result> {
  try { await apiDelete(`/vendor/listings/${id}`); return { ok: true } } catch (e) { return fail(e) }
}

/* -------------------------------- orders -------------------------------- */

export async function advanceOrderRemote(id: string): Promise<Result> {
  try { await apiPost(`/vendor/orders/${id}/advance`); return { ok: true } } catch (e) { return fail(e) }
}
export async function cancelOrderRemote(id: string, reason: string): Promise<Result> {
  try { await apiPost(`/vendor/orders/${id}/decline`, { reason }); return { ok: true } } catch (e) { return fail(e) }
}

/* ----------------------------- application ------------------------------ */

/** Send the vendor's current answers to the server (it merges and validates). Safe to call repeatedly. */
export async function pushProfile(profile: VendorProfile): Promise<{ ok: true } | { ok: false; error: string; fields?: Record<string, string> }> {
  try {
    await apiPut('/vendor/application', { business: profile.business, contact: profile.contact, payout: profile.payout, agreedToTerms: profile.agreedToTerms })
    const server = (await apiGet<{ application: ApiApplication }>('/vendor/application')).application
    // Documents: add what's new, remove what's gone (matched by kind: one document per kind).
    for (const d of profile.documents) {
      if (!server.documents.some((s) => s.kind === d.kind && s.fileName === d.fileName)) {
        await apiPost('/vendor/application/documents', { kind: d.kind, fileName: d.fileName, contentType: contentTypeOf(d.fileName), sizeKb: Math.max(1, Math.min(5120, d.sizeKb)) })
      }
    }
    for (const s of server.documents) if (!profile.documents.some((d) => d.kind === s.kind)) await apiDelete(`/vendor/application/documents/${s.id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorText(e), fields: e instanceof ApiError ? e.fields : undefined }
  }
}

const contentTypeOf = (name: string) => (/\.pdf$/i.test(name) ? 'application/pdf' : /\.png$/i.test(name) ? 'image/png' : 'image/jpeg')

export async function submitApplicationRemote(): Promise<Result> {
  try { await apiPost('/vendor/application/submit'); return { ok: true } } catch (e) { return fail(e) }
}

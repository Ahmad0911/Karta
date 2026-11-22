import { useEffect } from 'react'
import { create } from 'zustand'

import { apiGet, apiPost } from '@/lib/api'
import { errorText } from '@/store/auth.api'

import type { VendorRecord } from '../hooks/useAllVendors'
import type { ApplicationDecision } from './vendor.store'
import { toListing, toProfile, type Result } from './remote'
import type { VendorListing, VerificationEntry } from '../types'

/** Karta staff's view of every vendor, straight from the server (production builds). */
interface AdminListing { vendorEmail?: string }
interface Row { id: string; email: string; application: Parameters<typeof toProfile>[0] }

interface State {
  records: (VendorRecord & { applicationId: string })[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  load: (force?: boolean) => Promise<void>
  loadHistory: (email: string) => Promise<void>
}

export const useAdminVendors = create<State>()((set, get) => ({
  records: [],
  status: 'idle',

  load: async (force = false) => {
    if (!force && get().status === 'loading') return
    set({ status: 'loading' })
    try {
      const [apps, listings] = await Promise.all([
        apiGet<{ applications: Row[] }>('/admin/vendor-applications'),
        apiGet<{ listings: (Parameters<typeof toListing>[0] & AdminListing)[] }>('/admin/listings'),
      ])
      const byVendor = new Map<string, VendorListing[]>()
      for (const l of listings.listings) {
        const k = (l.vendorEmail ?? '').toLowerCase()
        byVendor.set(k, [...(byVendor.get(k) ?? []), toListing(l)])
      }
      const previous = new Map(get().records.map((r) => [r.email, r.workspace.profile.verificationLog]))
      set({
        status: 'ready',
        records: apps.applications.map((a) => {
          const email = a.email.toLowerCase()
          const profile = toProfile(a.application)
          profile.verificationLog = previous.get(email) ?? []
          return { applicationId: a.id, email, workspace: { profile, listings: byVendor.get(email) ?? [], orders: [], payouts: [] } }
        }),
      })
    } catch {
      set({ status: 'error' })
    }
  },

  /** The decision trail for one vendor (shown on their review page). */
  loadHistory: async (email) => {
    const rec = get().records.find((r) => r.email === email.toLowerCase())
    if (!rec) return
    try {
      const d = await apiGet<{ history: { at: string; action: VerificationEntry['action']; note: string | null; by: string }[] }>(`/admin/vendor-applications/${rec.applicationId}`)
      const log: VerificationEntry[] = d.history.map((h, i) => ({ id: `${rec.applicationId}-${i}`, at: h.at, by: h.by, action: h.action, note: h.note ?? undefined }))
      set((s) => ({ records: s.records.map((r) => (r.email === rec.email ? { ...r, workspace: { ...r.workspace, profile: { ...r.workspace.profile, verificationLog: log } } } : r)) }))
    } catch { /* the page still works without the trail */ }
  },
}))

export function useAdminVendorRecords(): VendorRecord[] {
  const records = useAdminVendors((s) => s.records)
  const load = useAdminVendors((s) => s.load)
  useEffect(() => {
    void load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, 30_000)
    return () => clearInterval(t)
  }, [load])
  return records
}

export async function decideApplicationRemote(email: string, decision: ApplicationDecision, note: string, trustScore?: number): Promise<Result> {
  const rec = useAdminVendors.getState().records.find((r) => r.email === email.toLowerCase())
  if (!rec) return { ok: false, error: 'Vendor not found.' }
  try {
    await apiPost(`/admin/vendor-applications/${rec.applicationId}/decision`, { decision, note: note.trim() || undefined, trustScore })
    await useAdminVendors.getState().load(true)
    await useAdminVendors.getState().loadHistory(email)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorText(e) }
  }
}

export async function moderateListingRemote(listingId: string, decision: 'approve' | 'reject', note: string): Promise<Result> {
  try {
    await apiPost(`/admin/listings/${listingId}/review`, { decision: decision === 'approve' ? 'approve' : 'send_back', note: note.trim() || undefined })
    await useAdminVendors.getState().load(true)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorText(e) }
  }
}

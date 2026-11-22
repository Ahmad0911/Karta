import { useEffect, useMemo } from 'react'
import { create } from 'zustand'

import { apiGet } from '@/lib/api'
import { AUTH_API } from '@/store/auth.api'

import { products as seedProducts } from '@/data/products'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import { vendorIdFor } from './vendorId'

export interface DirectoryVendor {
  id: string
  name: string
  trustScore: number
  /** Only known for platform vendors who filled in the application. */
  location?: string
  about?: string
  source: 'seed' | 'platform'
}

/**
 * Vendors customers can see. Platform vendors appear only when verified
 * (approved). Suspended, rejected and pending vendors are invisible.
 */
interface RemoteDirectory { vendors: DirectoryVendor[]; loaded: boolean; load: () => Promise<void> }
const useRemoteDirectory = create<RemoteDirectory>()((set, get) => ({
  vendors: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      const r = await apiGet<{ vendors: { id: string; name: string; trustScore: number; location: string; about: string }[] }>('/vendors')
      set({ loaded: true, vendors: r.vendors.map((v) => ({ ...v, source: 'platform' as const })) })
    } catch { /* leave empty; the page shows no vendors */ }
  },
}))

export function useVendorDirectory(): DirectoryVendor[] {
  // Production builds list the verified vendors from the API (never the demo vendors).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return AUTH_API ? useRemoteVendors() : useLocalVendors()
}

function useRemoteVendors(): DirectoryVendor[] {
  const vendors = useRemoteDirectory((s) => s.vendors)
  const load = useRemoteDirectory((s) => s.load)
  useEffect(() => { void load() }, [load])
  return vendors
}

function useLocalVendors(): DirectoryVendor[] {
  const byEmail = useVendorStore((s) => s.byEmail)

  return useMemo(() => {
    const seen = new Map<string, DirectoryVendor>()

    for (const p of seedProducts) {
      if (!seen.has(p.vendor.id)) {
        seen.set(p.vendor.id, {
          id: p.vendor.id,
          name: p.vendor.name,
          trustScore: p.vendor.trustScore,
          source: 'seed',
        })
      }
    }

    for (const [email, w] of Object.entries(byEmail)) {
      if (w.profile.status !== 'approved') continue
      const id = vendorIdFor(email)
      seen.set(id, {
        id,
        name: w.profile.business.name,
        trustScore: w.profile.trustScore,
        location: [w.profile.business.city, w.profile.business.state].filter(Boolean).join(', '),
        about: w.profile.business.description,
        source: 'platform',
      })
    }

    return [...seen.values()]
  }, [byEmail])
}

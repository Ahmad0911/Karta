import { useMemo } from 'react'

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
export function useVendorDirectory(): DirectoryVendor[] {
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

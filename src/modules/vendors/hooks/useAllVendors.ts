import { useMemo } from 'react'
import { useVendorStore } from '../store/vendor.store'
import type { VendorWorkspace } from '../types'

export interface VendorRecord {
  email: string
  workspace: VendorWorkspace
}

/** Every vendor on the platform. Staff screens only. */
export function useAllVendors(): VendorRecord[] {
  const byEmail = useVendorStore((s) => s.byEmail)
  return useMemo(
    () => Object.entries(byEmail).map(([email, workspace]) => ({ email, workspace })),
    [byEmail],
  )
}

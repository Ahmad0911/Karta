import { useMemo } from 'react'
import { useVendorStore } from '../store/vendor.store'
import type { VendorWorkspace } from '../types'
import { AUTH_API } from '@/store/auth.api'
import { useAdminVendorRecords } from '../store/adminRemote'

export interface VendorRecord {
  email: string
  workspace: VendorWorkspace
}

/** Every vendor on the platform. Staff screens only. */
export function useAllVendors(): VendorRecord[] {
  // Production builds read every vendor from the server (a build is either one mode or the other).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return AUTH_API ? useAdminVendorRecords() : useLocalVendors()
}

function useLocalVendors(): VendorRecord[] {
  const byEmail = useVendorStore((s) => s.byEmail)
  return useMemo(
    () => Object.entries(byEmail).map(([email, workspace]) => ({ email, workspace })),
    [byEmail],
  )
}

import { useMemo } from 'react'

import { useAuthStore } from '@/store/auth.store'
import { createEmptyProfile } from '../lib/onboarding'
import { useVendorStore } from '../store/vendor.store'
import type { VendorWorkspace } from '../types'

/**
 * The signed-in vendor's workspace.
 *
 * Returns a stable empty workspace until the store has created one, so pages
 * never have to handle "undefined" and never trigger render loops.
 */
export function useVendor(): { email: string; workspace: VendorWorkspace } {
  const user = useAuthStore((s) => s.user)!
  const stored = useVendorStore((s) => s.byEmail[user.email.trim().toLowerCase()])

  const fallback = useMemo<VendorWorkspace>(
    () => ({
      profile: createEmptyProfile(user),
      listings: [],
      orders: [],
      payouts: [],
    }),
    [user],
  )

  return { email: user.email, workspace: stored ?? fallback }
}

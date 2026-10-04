import { useAuthStore } from '@/store/auth.store'
import { useLogisticsStore } from '../store/logistics.store'
import type { Delivery } from '../types'

// Module-level constant so the selector result is referentially stable.
const NONE: Delivery[] = []

export function useLogistics(): { email: string; deliveries: Delivery[] } {
  const user = useAuthStore((s) => s.user)!
  const deliveries = useLogisticsStore(
    (s) => s.byEmail[user.email.trim().toLowerCase()]?.deliveries ?? NONE,
  )

  return { email: user.email, deliveries }
}

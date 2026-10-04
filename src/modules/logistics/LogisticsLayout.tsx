import { useMemo } from 'react'
import { ListChecks, Route } from 'lucide-react'

import PortalLayout, { type PortalNavItem } from '@/layouts/PortalLayout'
import { useAuthStore } from '@/store/auth.store'
import { useLogistics } from './hooks/useLogistics'
import { isActive } from './lib/deliveries'

export default function LogisticsLayout() {
  const user = useAuthStore((s) => s.user)!
  const { deliveries } = useLogistics()

  const nav = useMemo<PortalNavItem[]>(
    () => [
      { to: '/logistics', label: 'Today', icon: Route, end: true },
      {
        to: '/logistics/deliveries',
        label: 'Deliveries',
        icon: ListChecks,
        badge: deliveries.filter(isActive).length,
      },
    ],
    [deliveries],
  )

  return <PortalLayout title="Logistics" nav={nav} subtitle={user.email} />
}

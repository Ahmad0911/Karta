import { useMemo } from 'react'
import { ClipboardCheck, LayoutDashboard, MessageSquareWarning, PackageSearch, Truck, UserCheck, LifeBuoy, Undo2, Sparkles } from 'lucide-react'

import PortalLayout, { type PortalNavItem } from '@/layouts/PortalLayout'
import { useAuthStore } from '@/store/auth.store'
import { useAllVendors } from '@/modules/vendors/hooks/useAllVendors'
import { useApplicationsStore } from '@/modules/logistics/applications.store'
import { useReturnsStore } from '@/modules/returns/returns.store'
import { useSupportStore } from '@/modules/support/support.store'

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)!
  const vendors = useAllVendors()
  const applications = useApplicationsStore((s) => s.byEmail)
  const returns = useReturnsStore((s) => s.returns)
  const tickets = useSupportStore((s) => s.tickets)

  const nav = useMemo<PortalNavItem[]>(() => {
    const waiting = vendors.filter((v) => v.workspace.profile.status === 'under_review').length
    const toModerate = vendors.reduce(
      (n, v) => n + v.workspace.listings.filter((l) => l.status === 'in_review').length,
      0,
    )

    const driversWaiting = Object.values(applications).filter((a) => a.status === 'under_review').length

    const returnsNeedingStaff = returns.filter((r) => ['escalated', 'approved', 'received'].includes(r.status)).length
    const ticketsOpen = tickets.filter((t) => t.status === 'open').length

    return [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/vendors', label: 'Vendor applications', icon: ClipboardCheck, badge: waiting },
      { to: '/admin/listings', label: 'Listing moderation', icon: PackageSearch, badge: toModerate },
      { to: '/admin/returns', label: 'Returns', icon: Undo2, badge: returnsNeedingStaff },
      { to: '/admin/support', label: 'Support', icon: LifeBuoy, badge: ticketsOpen },
      { to: '/admin/requests', label: 'Custom requests', icon: Sparkles },
      { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareWarning },
      { to: '/admin/drivers/applications', label: 'Driver applications', icon: UserCheck, badge: driversWaiting },
      { to: '/admin/staff', label: 'Drivers', icon: Truck },
    ]
  }, [vendors, applications, returns, tickets])

  return <PortalLayout title="Admin" nav={nav} subtitle={user.email} />
}

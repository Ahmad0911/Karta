import { useEffect, useMemo } from 'react'
import {
  BarChart3,
  Star,
  Undo2,
  Sparkles,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  Wallet,
} from 'lucide-react'

import PortalLayout, { type PortalNavItem } from '@/layouts/PortalLayout'
import { useAuthStore } from '@/store/auth.store'
import { useVendorStore } from './store/vendor.store'
import { useReturnsStore } from '@/modules/returns/returns.store'
import { useRequestsStore } from '@/modules/requests/requests.store'
import { useVendor } from './hooks/useVendor'
import { VENDOR_POLICY } from './config'

/**
 * Vendor portal shell. Creates the vendor's workspace on first visit and
 * feeds live counts into the sidebar badges.
 */
export default function VendorLayout() {
  const user = useAuthStore((s) => s.user)!
  const ensureWorkspace = useVendorStore((s) => s.ensureWorkspace)
  const { workspace, email } = useVendor()
  const allReturns = useReturnsStore((s) => s.returns)
  const allRequests = useRequestsStore((s) => s.requests)

  useEffect(() => {
    ensureWorkspace(user)
  }, [ensureWorkspace, user])

  const { profile, orders, listings } = workspace

  const nav = useMemo<PortalNavItem[]>(() => {
    const newOrders = orders.filter((o) => o.status === 'new').length
    const lowStock = listings.filter(
      (l) => l.status === 'live' && l.stock <= VENDOR_POLICY.lowStockThreshold,
    ).length

    const toAnswer = allReturns.filter((r) => r.status === 'requested' && r.lines.every((l) => l.vendorEmail?.toLowerCase() === email.toLowerCase())).length

    const me = email.toLowerCase()
    const openRequests = allRequests.filter((r) => r.status === 'open' && !r.declinedBy.includes(me) && r.customerEmail !== me && (!r.categoryId || profile.business.categoryIds.includes(r.categoryId))).length

    const items: PortalNavItem[] = [
      { to: '/vendor', label: 'Overview', icon: LayoutDashboard, end: true },
    ]

    if (profile.status !== 'approved') {
      items.push({ to: '/vendor/onboarding', label: 'Application', icon: ClipboardCheck })
    }

    items.push(
      { to: '/vendor/products', label: 'Products', icon: Package, badge: lowStock },
      { to: '/vendor/orders', label: 'Orders', icon: ReceiptText, badge: newOrders },
      { to: '/vendor/payouts', label: 'Payouts', icon: Wallet },
      { to: '/vendor/requests', label: 'Requests', icon: Sparkles, badge: profile.status === 'approved' ? openRequests : 0 },
      { to: '/vendor/returns', label: 'Returns', icon: Undo2, badge: toAnswer },
      { to: '/vendor/reviews', label: 'Reviews', icon: Star },
      { to: '/vendor/insights', label: 'Insights', icon: BarChart3 },
      { to: '/vendor/settings', label: 'Store settings', icon: Settings },
    )

    return items
  }, [orders, listings, profile.status, profile.business.categoryIds, allReturns, allRequests, email])

  return (
    <PortalLayout
      title="Vendor portal"
      nav={nav}
      subtitle={profile.business.name || user.businessName || user.email}
    />
  )
}

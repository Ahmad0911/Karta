import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

import { StatusPill } from '@/components/portal/ui'
import { DELIVERY_META } from '../lib/deliveries'
import type { Delivery } from '../types'

export default function DeliveryRow({ delivery: d }: { delivery: Delivery }) {
  const meta = DELIVERY_META[d.status]

  return (
    <Link
      to={`/logistics/deliveries/${d.id}`}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
    >
      <span className="w-24 text-sm font-semibold">{d.orderNumber}</span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{d.customerName}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-[#151b1c]/45">
          <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
          {d.dropoffAddress}
        </span>
      </span>

      <span className="hidden text-xs text-[#151b1c]/45 md:block">{d.vendorName}</span>

      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
    </Link>
  )
}

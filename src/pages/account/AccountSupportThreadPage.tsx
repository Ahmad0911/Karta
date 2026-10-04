import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Card } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import Thread from '@/modules/support/Thread'
import { useSupportStore } from '@/modules/support/support.store'
import { useAuthStore } from '@/store/auth.store'

export default function AccountSupportThreadPage() {
  const { id } = useParams()
  const me = useAuthStore((s) => s.user)!.email.trim().toLowerCase()
  const ticket = useSupportStore((s) => s.tickets.find((t) => t.id === id))
  useDocumentTitle(ticket ? ticket.number : 'Support')

  // Someone else’s request looks exactly like a missing one.
  if (!ticket || ticket.requesterEmail !== me) return <Navigate to="/account/support" replace />

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-3xl space-y-6 py-12 sm:py-16">
        <Link to="/account/support" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"><ArrowLeft className="h-4 w-4" /> All requests</Link>
        <Card><Thread ticket={ticket} viewer="requester" /></Card>
      </div>
    </main>
  )
}

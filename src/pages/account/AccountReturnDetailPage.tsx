import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { useDocumentTitle } from '@/lib/useDocumentTitle'
import ReturnPanel from '@/modules/returns/ReturnPanel'
import { useReturnsStore } from '@/modules/returns/returns.store'
import { useAuthStore } from '@/store/auth.store'

export default function AccountReturnDetailPage() {
  const { id } = useParams()
  const user = useAuthStore((s) => s.user)!
  const ret = useReturnsStore((s) => s.returns.find((r) => r.id === id))
  useDocumentTitle(ret ? `Return ${ret.number}` : 'Return')

  // Someone else’s return looks exactly like a missing one.
  if (!ret || ret.customerEmail !== user.email.trim().toLowerCase()) return <Navigate to="/account/returns" replace />

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-3xl space-y-6 py-12 sm:py-16">
        <Link to="/account/returns" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"><ArrowLeft className="h-4 w-4" /> All returns</Link>
        <ReturnPanel ret={ret} viewer="customer" />
      </div>
    </main>
  )
}

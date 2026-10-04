import { useMemo, useState } from 'react'
import { Undo2 } from 'lucide-react'

import { Card, EmptyState, Notice, PageHeader } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import ReturnPanel from '@/modules/returns/ReturnPanel'
import { useReturnsStore } from '@/modules/returns/returns.store'
import { useAuthStore } from '@/store/auth.store'

type Tab = 'respond' | 'progress' | 'done'
const TABS: { id: Tab; label: string; test: (s: string) => boolean }[] = [
  { id: 'respond', label: 'Needs your response', test: (s) => s === 'requested' },
  { id: 'progress', label: 'In progress', test: (s) => ['approved', 'rejected', 'escalated', 'received'].includes(s) },
  { id: 'done', label: 'Finished', test: (s) => s === 'refunded' || s === 'closed' },
]

export default function VendorReturnsPage() {
  useDocumentTitle('Returns')

  const me = useAuthStore((s) => s.user)!.email.trim().toLowerCase()
  const all = useReturnsStore((s) => s.returns)
  const [tab, setTab] = useState<Tab>('respond')

  const mine = useMemo(() => all.filter((r) => r.lines.every((l) => l.vendorEmail?.toLowerCase() === me)), [all, me])
  const current = TABS.find((t) => t.id === tab)!
  const visible = mine.filter((r) => current.test(r.status))

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Aftercare" title="Returns" description="Respond within 48 hours. If you decline, explain why: the customer can ask Karta to review. Refunds reduce your earnings for the returned items." />

      {mine.length === 0 ? (
        <Card><EmptyState icon={<Undo2 className="h-5 w-5" />} title="No returns" body="Return requests for your products appear here." /></Card>
      ) : (
        <>
          <div role="tablist" aria-label="Filter returns" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${tab === t.id ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'}`}>
                {t.label} <span className="ml-1 opacity-60">{mine.filter((r) => t.test(r.status)).length}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? <Notice tone="info" title="Nothing here right now" /> : (
            <ul className="space-y-5">{visible.map((r) => <li key={r.id}><ReturnPanel ret={r} viewer="vendor" /></li>)}</ul>
          )}
        </>
      )}
    </div>
  )
}

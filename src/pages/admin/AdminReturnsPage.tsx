import { useMemo, useState } from 'react'
import { Undo2 } from 'lucide-react'

import { Card, EmptyState, Notice, PageHeader } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import ReturnPanel from '@/modules/returns/ReturnPanel'
import { useReturnsStore } from '@/modules/returns/returns.store'

type Tab = 'decide' | 'receive' | 'refund' | 'all'
const TABS: { id: Tab; label: string; test: (s: string) => boolean }[] = [
  { id: 'decide', label: 'Needs a decision', test: (s) => s === 'escalated' },
  { id: 'receive', label: 'Awaiting item', test: (s) => s === 'approved' },
  { id: 'refund', label: 'Ready to refund', test: (s) => s === 'received' },
  { id: 'all', label: 'All', test: () => true },
]

export default function AdminReturnsPage() {
  useDocumentTitle('Returns')

  const all = useReturnsStore((s) => s.returns)
  const [tab, setTab] = useState<Tab>('decide')
  const current = TABS.find((t) => t.id === tab)!
  const visible = useMemo(() => all.filter((r) => current.test(r.status)), [all, current])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Trust & safety" title="Returns & refunds" description="Decide appeals, confirm items have arrived, then refund through the payment provider. Each return can be refunded once." />

      {all.length === 0 ? (
        <Card><EmptyState icon={<Undo2 className="h-5 w-5" />} title="No returns yet" body="Return requests from customers appear here." /></Card>
      ) : (
        <>
          <div role="tablist" aria-label="Filter returns" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${tab === t.id ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'}`}>
                {t.label} <span className="ml-1 opacity-60">{all.filter((r) => t.test(r.status)).length}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? <Notice tone="info" title="Nothing here right now" /> : (
            <ul className="space-y-5">{visible.map((r) => <li key={r.id}><ReturnPanel ret={r} viewer="admin" /></li>)}</ul>
          )}
        </>
      )}
    </div>
  )
}

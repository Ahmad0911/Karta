import { useMemo, useState } from 'react'
import { LifeBuoy, Search } from 'lucide-react'

import { Card, EmptyState, PageHeader, inputClass } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import Thread from '@/modules/support/Thread'
import { useSupportStore, type TicketStatus } from '@/modules/support/support.store'

type Tab = TicketStatus | 'all'
const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'Needs reply' },
  { id: 'pending', label: 'Waiting for customer' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]

export default function AdminSupportPage() {
  useDocumentTitle('Support inbox')

  const all = useSupportStore((s) => s.tickets)
  const [tab, setTab] = useState<Tab>('open')
  const [q, setQ] = useState('')

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all
      .filter((t) => tab === 'all' || t.status === tab)
      .filter((t) => !needle || `${t.number} ${t.subject} ${t.requesterEmail} ${t.requesterName}`.toLowerCase().includes(needle))
      // Oldest waiting first, so nobody is left behind.
      .sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt))
  }, [all, tab, q])

  const count = (t: Tab) => (t === 'all' ? all.length : all.filter((x) => x.status === t).length)

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Customer care" title="Support inbox" description="Oldest waiting first. Internal notes are visible to staff only." />

      {all.length === 0 ? (
        <Card><EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No requests yet" body="Customer requests appear here." /></Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Filter requests" className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${tab === t.id ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'}`}>
                  {t.label} <span className="ml-1 opacity-60">{count(t.id)}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-72">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#151b1c]/35" />
              <input type="search" aria-label="Search requests" placeholder="Number, subject or customer" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass()} !h-11 pl-11`} />
            </div>
          </div>

          {visible.length === 0 ? <p className="py-10 text-center text-sm text-[#151b1c]/45">Nothing here.</p> : (
            <ul className="space-y-5">{visible.map((t) => <li key={t.id}><Card><Thread ticket={t} viewer="staff" /></Card></li>)}</ul>
          )}
        </>
      )}
    </div>
  )
}

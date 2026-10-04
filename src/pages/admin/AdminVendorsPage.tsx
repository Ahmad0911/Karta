import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users } from 'lucide-react'

import { Card, EmptyState, PageHeader, StatusPill, inputClass, type Tone } from '@/components/portal/ui'
import { formatDate } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

import { useAllVendors } from '@/modules/vendors/hooks/useAllVendors'
import type { VendorStatus } from '@/modules/vendors/types'

export const VENDOR_STATUS_META: Record<VendorStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Not submitted', tone: 'neutral' },
  under_review: { label: 'Awaiting review', tone: 'amber' },
  changes_requested: { label: 'Changes requested', tone: 'blue' },
  approved: { label: 'Verified', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  suspended: { label: 'Suspended', tone: 'red' },
}

type Tab = 'under_review' | 'approved' | 'changes_requested' | 'suspended' | 'rejected' | 'draft' | 'all'

const TABS: { id: Tab; label: string }[] = [
  { id: 'under_review', label: 'Awaiting review' },
  { id: 'approved', label: 'Verified' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'draft', label: 'Not submitted' },
  { id: 'all', label: 'All' },
]

export default function AdminVendorsPage() {
  useDocumentTitle('Vendor applications')

  const vendors = useAllVendors()
  const [tab, setTab] = useState<Tab>('under_review')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const count = (t: Tab) =>
    t === 'all' ? vendors.length : vendors.filter((v) => v.workspace.profile.status === t).length

  const visible = vendors
    .filter((v) => tab === 'all' || v.workspace.profile.status === tab)
    .filter(
      (v) =>
        !q ||
        v.email.includes(q) ||
        v.workspace.profile.business.name.toLowerCase().includes(q) ||
        v.workspace.profile.contact.phone.includes(q),
    )
    .sort(
      (a, b) =>
        +new Date(a.workspace.profile.submittedAt ?? 0) - +new Date(b.workspace.profile.submittedAt ?? 0),
    )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Trust & safety"
        title="Vendor applications"
        description="Review every vendor before they can sell. Look for mismatched names, reused phone numbers and bank accounts."
      />

      {vendors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No vendors yet"
            body="When someone applies to sell, their application will be listed here."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Filter vendors" className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    tab === t.id
                      ? 'border-[#151b1c] bg-[#151b1c] text-white'
                      : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'
                  }`}
                >
                  {t.label} <span className="ml-1 opacity-60">{count(t.id)}</span>
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#151b1c]/35" />
              <input
                type="search"
                aria-label="Search vendors"
                placeholder="Name, email or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputClass()} !h-11 pl-11`}
              />
            </div>
          </div>

          <Card>
            {visible.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-[#151b1c]/45">No vendors in this view.</p>
            ) : (
              <ul className="divide-y divide-[#151b1c]/[0.07]">
                {visible.map(({ email, workspace }) => {
                  const p = workspace.profile
                  const meta = VENDOR_STATUS_META[p.status]
                  return (
                    <li key={email}>
                      <Link
                        to={`/admin/vendors/${encodeURIComponent(email)}`}
                        className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.business.name || '(no name yet)'}</span>
                          <span className="block truncate text-xs text-[#151b1c]/45">
                            {email} · {p.business.city || '—'}
                          </span>
                        </span>
                        <span className="text-xs text-[#151b1c]/45">
                          {p.submittedAt ? `Submitted ${formatDate(p.submittedAt)}` : '—'}
                        </span>
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

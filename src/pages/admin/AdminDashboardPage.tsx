import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'

import { Card, CardHeader, EmptyState, PageHeader, StatCard } from '@/components/portal/ui'
import { formatDate, timeAgo } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'

import { useAllVendors } from '@/modules/vendors/hooks/useAllVendors'

export default function AdminDashboardPage() {
  useDocumentTitle('Admin')

  const user = useAuthStore((s) => s.user)!
  const vendors = useAllVendors()

  const by = (status: string) => vendors.filter((v) => v.workspace.profile.status === status)
  const queue = by('under_review').sort(
    (a, b) =>
      +new Date(a.workspace.profile.submittedAt ?? 0) - +new Date(b.workspace.profile.submittedAt ?? 0),
  )
  const toModerate = vendors.reduce(
    (n, v) => n + v.workspace.listings.filter((l) => l.status === 'in_review').length,
    0,
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control center"
        title={`Hello, ${user.name.split(/\s+/)[0]}.`}
        description="Nobody sells on Karta until a person on this team has verified them."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting verification"
          value={queue.length}
          tone={queue.length ? 'alert' : 'neutral'}
          to="/admin/vendors"
          hint="Oldest first"
        />
        <StatCard label="Listings to moderate" value={toModerate} tone={toModerate ? 'alert' : 'neutral'} to="/admin/listings" />
        <StatCard label="Verified vendors" value={by('approved').length} />
        <StatCard label="Suspended / rejected" value={by('suspended').length + by('rejected').length} />
      </div>

      <Card>
        <CardHeader title="Verification queue" description="Applications submitted and waiting for a decision" />
        {queue.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Queue is clear"
            body="New vendor applications appear here the moment they are submitted."
          />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {queue.map(({ email, workspace }) => (
              <li key={email}>
                <Link
                  to={`/admin/vendors/${encodeURIComponent(email)}`}
                  className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 transition hover:bg-[#151b1c]/[0.025] sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{workspace.profile.business.name}</span>
                    <span className="block truncate text-xs text-[#151b1c]/45">
                      {workspace.profile.business.city}, {workspace.profile.business.state} · {workspace.profile.business.type === 'registered' ? 'Registered business' : 'Individual maker'}
                    </span>
                  </span>
                  <span
                    className="text-xs text-[#151b1c]/45"
                    title={workspace.profile.submittedAt ? formatDate(workspace.profile.submittedAt) : ''}
                  >
                    Waiting {workspace.profile.submittedAt ? timeAgo(workspace.profile.submittedAt).replace(' ago', '') : ''}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#151b1c]/30" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

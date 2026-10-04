import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileText, Info } from 'lucide-react'

import {
  Card,
  CardHeader,
  FormField,
  Notice,
  PageHeader,
  StatusPill,
  dangerBtn,
  inputClass,
  primaryBtn,
  secondaryBtn,
  textareaClass,
} from '@/components/portal/ui'
import { categories } from '@/data/categories'
import { formatDate, formatDateTime } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import { signalsFor } from '@/modules/admin/lib/fraud'
import { DOCUMENT_SPECS } from '@/modules/vendors/data/reference'
import { useAllVendors } from '@/modules/vendors/hooks/useAllVendors'
import { firstIncompleteStep, requiredDocumentKinds } from '@/modules/vendors/lib/onboarding'
import { useVendorStore, type ApplicationDecision } from '@/modules/vendors/store/vendor.store'
import { VENDOR_STATUS_META } from './AdminVendorsPage'

const CHECKS = (registered: boolean) => [
  'The ID document is genuine and the name matches the contact person',
  ...(registered ? ['The CAC number is valid on the CAC public search and matches the business name'] : []),
  'The proof of address matches the address given (and is recent)',
  'The payout account name matches the business or the person',
  'I have read the warnings above and I’m satisfied with them',
]

export default function AdminVendorDetailPage() {
  const { email: raw } = useParams()
  const email = decodeURIComponent(raw ?? '')

  const all = useAllVendors()
  const record = all.find((v) => v.email === email)
  const decide = useVendorStore((s) => s.decideApplication)

  useDocumentTitle(record ? `Review ${record.workspace.profile.business.name}` : 'Vendor')

  const [checked, setChecked] = useState<boolean[]>([])
  const [trust, setTrust] = useState('60')
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [pending, setPending] = useState<ApplicationDecision | null>(null)

  if (!record) return <Navigate to="/admin/vendors" replace />

  const { profile, listings } = record.workspace
  const b = profile.business
  const meta = VENDOR_STATUS_META[profile.status]
  const registered = b.type === 'registered'

  const checklist = CHECKS(registered)
  const allChecked = checklist.every((_, i) => checked[i])
  const complete = firstIncompleteStep(profile) === -1
  const signals = signalsFor(record, all)
  const warnings = signals.filter((s) => s.level === 'warning')

  const run = (decision: ApplicationDecision) => {
    const result = decide(email, decision, note, decision === 'approve' ? Number(trust) : undefined)
    if (!result.ok) {
      setNoteError(result.error)
      toast.error(result.error)
      return
    }
    toast.success(
      {
        approve: 'Vendor verified. They can now submit products.',
        request_changes: 'Sent back to the vendor with your note.',
        reject: 'Application rejected.',
        suspend: 'Vendor suspended. Their products are hidden.',
        reinstate: 'Vendor reinstated.',
      }[decision],
    )
    setPending(null)
    setNote('')
    setNoteError('')
  }

  const startNoteDecision = (d: ApplicationDecision) => {
    setNoteError('')
    setPending(d)
  }

  const status = profile.status

  return (
    <div className="space-y-8">
      <Link to="/admin/vendors" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]">
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>

      <PageHeader
        eyebrow={email}
        title={b.name || 'Unnamed vendor'}
        description={`${registered ? `Registered business · ${b.rcNumber}` : 'Individual maker'} · ${b.city}, ${b.state}`}
        actions={<StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
      />

      {/* ------------------------------ Signals ------------------------------ */}
      {signals.length > 0 && (
        <Card>
          <CardHeader title="Things to check" description="Automatic signals. They inform your decision, they don’t make it." />
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {signals.map((s) => (
              <li key={s.text} className="flex gap-3 px-5 py-3.5 text-sm sm:px-6">
                {s.level === 'warning' ? (
                  <AlertTriangle aria-label="Warning" className="mt-0.5 h-4 w-4 shrink-0 text-[#b7791f]" />
                ) : (
                  <Info aria-label="Note" className="mt-0.5 h-4 w-4 shrink-0 text-[#2b4a6b]" />
                )}
                <span className="leading-6">{s.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Business" />
          <dl className="divide-y divide-[#151b1c]/[0.06] text-sm">
            {[
              ['Name', b.name],
              ['Type', registered ? `Registered · ${b.rcNumber}` : 'Individual maker'],
              ['Categories', b.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(', ')],
              ['Address', `${b.address}, ${b.city}, ${b.state}`],
              ['About', b.description],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[7rem_1fr] sm:px-6">
                <dt className="text-[#151b1c]/45">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact & payout" />
            <dl className="divide-y divide-[#151b1c]/[0.06] text-sm">
              {[
                ['Person', profile.contact.person],
                ['Email', profile.contact.email],
                ['Phone', profile.contact.phone],
                ['WhatsApp', profile.contact.whatsapp || '—'],
                ['Bank', profile.payout.bankName],
                ['Account', `${profile.payout.accountNumber}`],
                ['Account name', profile.payout.accountName],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[7rem_1fr] sm:px-6">
                  <dt className="text-[#151b1c]/45">{k}</dt>
                  <dd className="break-words tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Documents" description="In production these open from secure storage." />
            <ul className="divide-y divide-[#151b1c]/[0.06]">
              {requiredDocumentKinds(profile).map((spec) => {
                const doc = profile.documents.find((d) => d.kind === spec.kind)
                return (
                  <li key={spec.kind} className="flex items-center gap-3 px-5 py-3 text-sm sm:px-6">
                    <FileText className="h-4 w-4 shrink-0 text-[#8f7651]" />
                    <span className="min-w-0 flex-1">
                      <span className="block">{spec.label}</span>
                      <span className="block truncate text-xs text-[#151b1c]/45">{doc?.fileName ?? 'Missing'}</span>
                    </span>
                    {doc ? <StatusPill tone="green">Received</StatusPill> : <StatusPill tone="red">Missing</StatusPill>}
                  </li>
                )
              })}
              {profile.documents
                .filter((d) => !requiredDocumentKinds(profile).some((r) => r.kind === d.kind))
                .map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm sm:px-6">
                    <FileText className="h-4 w-4 shrink-0 text-[#8f7651]" />
                    <span className="flex-1">
                      {DOCUMENT_SPECS.find((s) => s.kind === d.kind)?.label}
                      <span className="block truncate text-xs text-[#151b1c]/45">{d.fileName}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* ------------------------------ Decision ------------------------------ */}
      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-xl tracking-[-0.02em]">Decision</h2>

        {status === 'draft' && (
          <p className="mt-3 text-sm text-[#151b1c]/55">The vendor hasn’t submitted their application yet.</p>
        )}

        {status === 'changes_requested' && (
          <div className="mt-3 space-y-4">
            <Notice tone="info" title="Waiting for the vendor">
              You asked for: {profile.reviewNote}
            </Notice>
            <button type="button" className={dangerBtn} onClick={() => startNoteDecision('reject')}>Reject instead</button>
          </div>
        )}

        {status === 'rejected' && (
          <p className="mt-3 text-sm text-[#151b1c]/55">Rejected. Reason shared with the vendor: {profile.reviewNote}</p>
        )}

        {status === 'under_review' && !pending && (
          <div className="mt-4 space-y-5">
            {!complete && (
              <Notice tone="danger" title="This application is incomplete">
                It can’t be approved until all sections are filled in. Request changes instead.
              </Notice>
            )}

            {warnings.length > 0 && (
              <Notice tone="warning" title={`${warnings.length} warning${warnings.length === 1 ? '' : 's'} above`}>
                Take extra care. Contact the vendor if anything is unclear.
              </Notice>
            )}

            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">
                Verification checklist
              </legend>
              <div className="space-y-2">
                {checklist.map((label, i) => (
                  <label key={label} className="flex cursor-pointer gap-3 rounded-xl border border-[#151b1c]/[0.1] p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[#151b1c]"
                      checked={!!checked[i]}
                      onChange={(e) => setChecked((c) => Object.assign([...c], { [i]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="max-w-xs">
              <FormField id="trust" label="Starting trust score" hint="New vendors start lower and earn trust through deliveries and reviews.">
                <input
                  id="trust"
                  inputMode="numeric"
                  className={inputClass()}
                  value={trust}
                  onChange={(e) => setTrust(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  aria-describedby="trust-msg"
                />
              </FormField>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryBtn} disabled={!allChecked || !complete} onClick={() => run('approve')}>
                Verify vendor
              </button>
              <button type="button" className={secondaryBtn} onClick={() => startNoteDecision('request_changes')}>
                Request changes
              </button>
              <button type="button" className={dangerBtn} onClick={() => startNoteDecision('reject')}>
                Reject
              </button>
            </div>
          </div>
        )}

        {status === 'approved' && !pending && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#151b1c]/55">
              Verified {profile.approvedAt ? formatDate(profile.approvedAt) : ''} · trust score {profile.trustScore} · {listings.filter((l) => l.status === 'live').length} live product(s)
            </p>
            <button type="button" className={dangerBtn} onClick={() => startNoteDecision('suspend')}>
              Suspend vendor
            </button>
          </div>
        )}

        {status === 'suspended' && !pending && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#151b1c]/55">Suspended: {profile.reviewNote}</p>
            <button type="button" className={primaryBtn} onClick={() => run('reinstate')}>Reinstate vendor</button>
          </div>
        )}

        {pending && (
          <div className="mt-4 space-y-4">
            <FormField
              id="decision-note"
              label={
                pending === 'request_changes' ? 'What should the vendor fix?' : pending === 'suspend' ? 'Reason for suspension' : 'Reason (the vendor will see this)'
              }
              required
              error={noteError}
              hint="Be specific and professional."
            >
              <textarea
                id="decision-note"
                className={textareaClass(!!noteError)}
                value={note}
                aria-invalid={noteError ? true : undefined}
                aria-describedby="decision-note-msg"
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteError('')
                }}
              />
            </FormField>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => setPending(null)}>Cancel</button>
              <button type="button" className={pending === 'request_changes' ? primaryBtn : dangerBtn} onClick={() => run(pending)}>
                Confirm
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ------------------------------- Audit log ----------------------------- */}
      <Card>
        <CardHeader title="Audit log" description="Every submission and decision, permanently recorded." />
        {(profile.verificationLog ?? []).length === 0 ? (
          <p className="px-6 py-8 text-sm text-[#151b1c]/45">No activity yet.</p>
        ) : (
          <ol className="divide-y divide-[#151b1c]/[0.06]">
            {[...(profile.verificationLog ?? [])].reverse().map((e) => (
              <li key={e.id} className="px-5 py-3.5 text-sm sm:px-6">
                <p>
                  <strong className="capitalize">{e.action.replace('_', ' ')}</strong>{' '}
                  <span className="text-[#151b1c]/45">by {e.by}</span>
                </p>
                <p className="text-xs text-[#151b1c]/40">{formatDateTime(e.at)}</p>
                {e.note && <p className="mt-1 text-[#151b1c]/60">{e.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

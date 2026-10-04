import { useState } from 'react'
import { AlertTriangle, FileText, Truck } from 'lucide-react'

import { Card, CardHeader, EmptyState, FormField, PageHeader, StatusPill, dangerBtn, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { formatDate } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { LOGISTICS_DOCS, VEHICLES, useApplicationsStore, type LogisticsApplication } from '@/modules/logistics/applications.store'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

const CHECKS = [
  'The ID is genuine and the name matches the applicant',
  'The driver’s licence is valid, not expired, and the name matches',
  'The vehicle papers match the plate number and the vehicle type',
  'I phoned the guarantor and they vouched for the applicant',
]

const digits = (s: string) => s.replace(/\D/g, '').slice(-10)

function signalsFor(app: LogisticsApplication, all: LogisticsApplication[], driverPhones: string[]) {
  const out: string[] = []
  for (const o of all.filter((x) => x.email !== app.email)) {
    if (digits(o.phone) === digits(app.phone)) out.push(`Same phone number as ${o.name} (${o.status.replace('_', ' ')}).`)
    if (o.plateNumber === app.plateNumber) out.push(`Same plate number as ${o.name} (${o.status.replace('_', ' ')}).`)
    if (o.licenceNumber === app.licenceNumber) out.push(`Same licence number as ${o.name} (${o.status.replace('_', ' ')}).`)
    if (digits(o.guarantor.phone) === digits(app.guarantor.phone)) out.push(`Same guarantor phone as ${o.name}.`)
    if (o.status === 'rejected' && (digits(o.phone) === digits(app.phone) || o.licenceNumber === app.licenceNumber)) {
      out.push('A previously REJECTED application used the same phone or licence.')
    }
  }
  if (driverPhones.includes(digits(app.phone))) out.push('This phone number already belongs to an active driver.')
  if (digits(app.guarantor.phone) === digits(app.phone)) out.push('Guarantor phone is the same as the applicant’s.')
  return [...new Set(out)]
}

export default function AdminDriverApplicationsPage() {
  useDocumentTitle('Driver applications')

  const byEmail = useApplicationsStore((s) => s.byEmail)
  const decide = useApplicationsStore((s) => s.decide)
  const accounts = useAuthStore((s) => s.accounts)

  const all = Object.values(byEmail).sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt))
  const queue = all.filter((a) => a.status === 'under_review')
  const decided = all.filter((a) => a.status !== 'under_review').reverse()

  const driverPhones = Object.values(accounts).filter((a) => a.user.role === 'logistics').map((a) => digits(a.user.phone ?? ''))

  const [checked, setChecked] = useState<Record<string, boolean[]>>({})
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const run = (email: string, d: 'approve' | 'reject') => {
    const r = decide(email, d, note)
    if (!r.ok) {
      setError(r.error)
      toast.error(r.error)
      return
    }
    toast.success(d === 'approve' ? 'Driver approved. They can now open the driver portal.' : 'Application rejected.')
    setRejecting(null)
    setNote('')
    setError('')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Driver applications"
        description="Verify identity, licence, vehicle and guarantor before anyone can accept deliveries or see customer addresses."
      />

      {queue.length === 0 ? (
        <Card><EmptyState icon={<Truck className="h-5 w-5" />} title="No applications waiting" body="New driver applications appear here the moment they’re submitted." /></Card>
      ) : (
        <ul className="space-y-6">
          {queue.map((a) => {
            const ticks = checked[a.email] ?? []
            const allTicked = CHECKS.every((_, i) => ticks[i])
            const signals = signalsFor(a, all, driverPhones)
            const vehicle = VEHICLES.find((v) => v.id === a.vehicle)?.label

            return (
              <li key={a.email}>
                <Card>
                  <CardHeader title={a.name} description={`${a.email} · applied ${formatDate(a.submittedAt)}`} action={<StatusPill tone="amber">Awaiting review</StatusPill>} />

                  {signals.length > 0 && (
                    <ul className="divide-y divide-[#151b1c]/[0.07] border-b border-[#151b1c]/[0.07]">
                      {signals.map((s) => (
                        <li key={s} className="flex gap-3 px-5 py-3 text-sm sm:px-6"><AlertTriangle aria-label="Warning" className="mt-0.5 h-4 w-4 shrink-0 text-[#b7791f]" />{s}</li>
                      ))}
                    </ul>
                  )}

                  <dl className="grid gap-x-8 divide-y divide-[#151b1c]/[0.06] text-sm sm:grid-cols-2 sm:divide-y-0">
                    {[
                      ['Phone', a.phone],
                      ['Area', `${a.city}, ${a.state}`],
                      ['Vehicle', `${vehicle} · ${a.plateNumber}`],
                      ['Licence', a.licenceNumber],
                      ['Experience', `${a.experienceYears} year${a.experienceYears === 1 ? '' : 's'}`],
                      ['Guarantor', `${a.guarantor.name} · ${a.guarantor.phone}`],
                    ].map(([k, v]) => (
                      <div key={k} className="grid gap-1 px-5 py-3 sm:px-6"><dt className="text-[#151b1c]/45">{k}</dt><dd className="break-words">{v}</dd></div>
                    ))}
                  </dl>

                  <ul className="border-t border-[#151b1c]/[0.07]">
                    {LOGISTICS_DOCS.map((d) => {
                      const doc = a.documents.find((x) => x.kind === d.kind)
                      return (
                        <li key={d.kind} className="flex items-center gap-3 px-5 py-3 text-sm sm:px-6">
                          <FileText className="h-4 w-4 shrink-0 text-[#8f7651]" />
                          <span className="min-w-0 flex-1"><span className="block">{d.label}</span><span className="block truncate text-xs text-[#151b1c]/45">{doc?.fileName ?? 'Missing'}</span></span>
                          {doc ? <StatusPill tone="green">Received</StatusPill> : <StatusPill tone="red">Missing</StatusPill>}
                        </li>
                      )
                    })}
                  </ul>

                  <div className="space-y-4 border-t border-[#151b1c]/[0.07] p-5 sm:p-6">
                    {rejecting === a.email ? (
                      <>
                        <FormField id={`rej-${a.email}`} label="Reason (the applicant will see this)" required error={error}>
                          <textarea id={`rej-${a.email}`} className={textareaClass(!!error)} value={note} aria-invalid={error ? true : undefined} aria-describedby={`rej-${a.email}-msg`} onChange={(e) => { setNote(e.target.value); setError('') }} />
                        </FormField>
                        <div className="flex justify-end gap-2">
                          <button type="button" className={secondaryBtn} onClick={() => { setRejecting(null); setError('') }}>Cancel</button>
                          <button type="button" className={dangerBtn} onClick={() => run(a.email, 'reject')}>Confirm rejection</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <fieldset>
                          <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">Verification checklist</legend>
                          <div className="space-y-2">
                            {CHECKS.map((c, i) => (
                              <label key={c} className="flex cursor-pointer gap-3 rounded-xl border border-[#151b1c]/[0.1] p-3 text-sm">
                                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#151b1c]" checked={!!ticks[i]} onChange={(e) => setChecked((p) => ({ ...p, [a.email]: Object.assign([...(p[a.email] ?? [])], { [i]: e.target.checked }) }))} />
                                {c}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" className={dangerBtn} onClick={() => { setRejecting(a.email); setNote(''); setError('') }}>Reject</button>
                          <button type="button" className={primaryBtn} disabled={!allTicked} onClick={() => run(a.email, 'approve')}>Approve driver</button>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <Card>
          <CardHeader title="Decided" description="Most recent first" />
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {decided.map((a) => (
              <li key={a.email} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 text-sm sm:px-6">
                <span className="min-w-0 flex-1"><span className="block font-semibold">{a.name}</span><span className="block text-xs text-[#151b1c]/45">{a.email} · by {a.decidedBy} · {a.decidedAt ? formatDate(a.decidedAt) : ''}</span></span>
                {a.note && <span className="max-w-xs truncate text-xs text-[#151b1c]/50" title={a.note}>{a.note}</span>}
                <StatusPill tone={a.status === 'approved' ? 'green' : 'red'}>{a.status === 'approved' ? 'Approved' : 'Rejected'}</StatusPill>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

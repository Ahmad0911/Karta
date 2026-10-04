import { useState } from 'react'
import { FlaskConical } from 'lucide-react'

import { Card, EmptyState, FormField, PageHeader, StatusPill, dangerBtn, inputClass, secondaryBtn } from '@/components/portal/ui'
import { formatDate } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'
import { Stars } from '@/modules/reviews/components/Stars'
import { useReviewsStore } from '@/modules/reviews/reviews.store'

export default function AdminReviewsPage() {
  useDocumentTitle('Reviews')

  const reviews = useReviewsStore((s) => s.reviews)
  const setHidden = useReviewsStore((s) => s.setHidden)
  const loadSamples = useReviewsStore((s) => s.devLoadSamples)
  const clearSamples = useReviewsStore((s) => s.devClearSamples)

  const [hiding, setHiding] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const act = (id: string, hide: boolean) => {
    const r = setHidden(id, hide, reason)
    if (!r.ok) {
      setError(r.error)
      return
    }
    toast.success(hide ? 'Review hidden' : 'Review restored')
    setHiding(null)
    setReason('')
    setError('')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Trust & safety"
        title="Reviews"
        description="Hide only reviews that break the rules (personal data, abuse, spam). A reason is always recorded. Never hide a review just because it is negative."
      />

      {reviews.length === 0 ? (
        <Card><EmptyState icon={<FlaskConical className="h-5 w-5" />} title="No reviews yet" body="Reviews appear here as customers rate vendors and delivery." /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {reviews.map((r) => (
              <li key={r.id} className="px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Stars value={r.rating} size={14} />
                  <strong>{r.authorLabel}</strong>
                  <span className="text-[#151b1c]/50">→ {r.targetName} ({r.target})</span>
                  <span className="text-xs text-[#151b1c]/40">{formatDate(r.createdAt)}</span>
                  {r.sample && <StatusPill tone="neutral">Sample</StatusPill>}
                  {r.status === 'hidden' && <StatusPill tone="red">Hidden</StatusPill>}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#151b1c]/75">{r.body}</p>
                {r.hiddenReason && <p className="mt-1 text-xs text-[#9b302d]">Hidden because: {r.hiddenReason}</p>}

                <div className="mt-3">
                  {hiding === r.id ? (
                    <div className="space-y-3">
                      <FormField id={`hide-${r.id}`} label="Reason for hiding" error={error}>
                        <input id={`hide-${r.id}`} className={inputClass(!!error)} value={reason} aria-invalid={error ? true : undefined} aria-describedby={`hide-${r.id}-msg`} onChange={(e) => { setReason(e.target.value); setError('') }} />
                      </FormField>
                      <div className="flex gap-2">
                        <button type="button" className={secondaryBtn} onClick={() => { setHiding(null); setError('') }}>Cancel</button>
                        <button type="button" className={dangerBtn} onClick={() => act(r.id, true)}>Hide review</button>
                      </div>
                    </div>
                  ) : r.status === 'hidden' ? (
                    <button type="button" className={secondaryBtn} onClick={() => act(r.id, false)}>Restore</button>
                  ) : (
                    <button type="button" className="text-xs font-semibold text-[#9b302d] underline underline-offset-4" onClick={() => { setHiding(r.id); setReason(''); setError('') }}>Hide…</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {import.meta.env.DEV && (
        <section aria-label="Developer controls" className="rounded-[1.25rem] border border-dashed border-[#8f7651]/50 bg-[#b79a6b]/[0.08] p-5">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6540]"><FlaskConical className="h-4 w-4" /> Dev only</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className={secondaryBtn} onClick={() => { loadSamples(); toast.info('Sample reviews loaded') }}>Load sample reviews</button>
            <button type="button" className={secondaryBtn} onClick={() => { clearSamples(); toast.info('Sample reviews removed') }}>Remove samples</button>
          </div>
        </section>
      )}
    </div>
  )
}

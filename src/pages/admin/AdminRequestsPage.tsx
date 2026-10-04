import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'

import { Card, EmptyState, FormField, PageHeader, StatusPill, dangerBtn, inputClass, secondaryBtn } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import RequestSummary, { REQUEST_STATUS } from '@/modules/requests/RequestSummary'
import { useRequestsStore } from '@/modules/requests/requests.store'
import { toast } from '@/store/toast.store'

export default function AdminRequestsPage() {
  useDocumentTitle('Custom requests')

  const all = useRequestsStore((s) => s.requests)
  const remove = useRequestsStore((s) => s.adminRemove)
  const [removing, setRemoving] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const list = useMemo(() => [...all].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [all])

  const act = (id: string) => {
    const r = remove(id, reason)
    if (!r.ok) return setError(r.error)
    toast.success('Request removed')
    setRemoving(null); setReason(''); setError('')
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Trust & safety" title="Custom requests" description="Remove requests that are abusive, illegal or try to move deals off Karta. Removing one also retires any private piece made for it." />
      {list.length === 0 ? (
        <Card><EmptyState icon={<Sparkles className="h-5 w-5" />} title="No requests yet" body="Customer requests appear here." /></Card>
      ) : (
        <ul className="space-y-5">
          {list.map((r) => (
            <li key={r.id}>
              <Card className="space-y-4 p-5 sm:p-6">
                <RequestSummary r={r} />
                {r.offer && <p className="text-sm text-[#151b1c]/60">Offer from <strong>{r.offer.vendorName}</strong>: ₦{r.offer.price.toLocaleString('en-NG')} in {r.offer.days} days</p>}
                {r.removedReason && <p className="text-sm text-[#9b302d]">Removed: {r.removedReason}</p>}
                {!['removed', 'ordered', 'closed'].includes(r.status) && (
                  removing === r.id ? (
                    <div className="space-y-3">
                      <FormField id={`rm-${r.id}`} label="Reason for removing" error={error}><input id={`rm-${r.id}`} className={inputClass(!!error)} value={reason} aria-invalid={error ? true : undefined} aria-describedby={`rm-${r.id}-msg`} onChange={(e) => { setReason(e.target.value); setError('') }} /></FormField>
                      <div className="flex justify-end gap-2"><button type="button" className={secondaryBtn} onClick={() => { setRemoving(null); setError('') }}>Cancel</button><button type="button" className={dangerBtn} onClick={() => act(r.id)}>Remove request</button></div>
                    </div>
                  ) : <div className="flex justify-end"><button type="button" className={dangerBtn} onClick={() => { setRemoving(r.id); setReason('') }}>Remove…</button></div>
                )}
                {r.status === 'removed' && <StatusPill tone="red">Removed</StatusPill>}
                {r.status !== 'removed' && <span className="sr-only">{REQUEST_STATUS[r.status].label}</span>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

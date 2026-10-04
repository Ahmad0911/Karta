import { useState } from 'react'
import { PackageCheck } from 'lucide-react'

import SafeImage from '@/components/ui/SafeImage'
import { Card, EmptyState, FormField, PageHeader, dangerBtn, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import { useAllVendors } from '@/modules/vendors/hooks/useAllVendors'
import { categoryName, roomName } from '@/modules/vendors/lib/listings'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'

export default function AdminListingsPage() {
  useDocumentTitle('Listing moderation')

  const vendors = useAllVendors()
  const moderate = useVendorStore((s) => s.moderateListing)

  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const queue = vendors.flatMap((v) =>
    v.workspace.listings
      .filter((l) => l.status === 'in_review')
      .map((l) => ({ vendor: v, listing: l })),
  )

  const act = (email: string, id: string, decision: 'approve' | 'reject') => {
    const r = moderate(email, id, decision, note)
    if (!r.ok) {
      setError(r.error)
      return
    }
    toast.success(decision === 'approve' ? 'Listing is now live.' : 'Sent back to the vendor.')
    setRejecting(null)
    setNote('')
    setError('')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Trust & safety"
        title="Listing moderation"
        description="Check photos match the description, prices are honest and the piece belongs on Karta."
      />

      {queue.length === 0 ? (
        <Card>
          <EmptyState icon={<PackageCheck className="h-5 w-5" />} title="Nothing to moderate" body="Listings submitted by verified vendors appear here." />
        </Card>
      ) : (
        <ul className="space-y-5">
          {queue.map(({ vendor, listing: l }) => (
            <li key={l.id}>
              <Card className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="grid w-full max-w-[18rem] shrink-0 grid-cols-2 gap-2">
                    {l.images.slice(0, 4).map((src, i) => (
                      <SafeImage key={i} src={src} alt={`${l.name} photo ${i + 1}`} className={`aspect-square rounded-lg bg-[#eae5db] ${l.images.length === 1 ? 'col-span-2' : ''}`} />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f7651]">
                      {vendor.workspace.profile.business.name} · {l.sku}
                    </p>
                    <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">{l.name}</h2>
                    <p className="mt-1 text-sm text-[#151b1c]/55">
                      {categoryName(l.categoryId)} · {roomName(l.room)} · {l.material} · {l.dimensions}
                    </p>
                    <p className="mt-3 text-sm leading-6">{l.description}</p>
                    <p className="mt-3 text-sm font-semibold tabular-nums">
                      {formatNaira(l.price)}
                      {l.originalPrice ? <span className="ml-2 font-normal text-[#151b1c]/40 line-through">{formatNaira(l.originalPrice)}</span> : null}
                      <span className="ml-3 font-normal text-[#151b1c]/45">{l.stock} in stock · {l.deliveryMinDays}–{l.deliveryMaxDays} days</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-[#151b1c]/[0.07] pt-5">
                  {rejecting === l.id ? (
                    <div className="space-y-4">
                      <FormField id={`rej-${l.id}`} label="What needs fixing?" required error={error}>
                        <textarea
                          id={`rej-${l.id}`}
                          className={textareaClass(!!error)}
                          value={note}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={`rej-${l.id}-msg`}
                          onChange={(e) => {
                            setNote(e.target.value)
                            setError('')
                          }}
                        />
                      </FormField>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" className={secondaryBtn} onClick={() => { setRejecting(null); setError('') }}>Cancel</button>
                        <button type="button" className={dangerBtn} onClick={() => act(vendor.email, l.id, 'reject')}>Send back to vendor</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={dangerBtn} onClick={() => { setRejecting(l.id); setNote(''); setError('') }}>Send back</button>
                      <button type="button" className={primaryBtn} onClick={() => act(vendor.email, l.id, 'approve')}>Approve and publish</button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

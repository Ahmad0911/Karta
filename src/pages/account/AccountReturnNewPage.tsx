import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, X } from 'lucide-react'

import { Card, FormField, Notice, PageHeader, inputClass, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { POLICY } from '@/config/company'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { prepareImage } from '@/lib/images'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { MAX_PHOTOS, REASONS, canStartReturn, needsPhotos, remainingQty, windowEnd } from '@/modules/returns/lib'
import { useReturnsStore } from '@/modules/returns/returns.store'
import type { ReturnReason } from '@/modules/returns/types'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

export default function AccountReturnNewPage() {
  useDocumentTitle('Start a return')

  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)!
  const order = useOrdersStore((s) => s.orders.find((o) => o.id === params.get('order')))
  const returns = useReturnsStore((s) => s.returns)
  const create = useReturnsStore((s) => s.create)

  const left = useMemo(() => (order ? remainingQty(order, returns) : {}), [order, returns])
  const vendors = useMemo(() => (order ? [...new Map(order.lines.map((l) => [l.vendorId, l.vendorName])).entries()] : []), [order])

  const [vendorId, setVendorId] = useState<string>(vendors[0]?.[0] ?? '')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<ReturnReason | ''>('')
  const [details, setDetails] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  if (!order || order.customerEmail !== user.email.trim().toLowerCase() || !canStartReturn(order, returns)) {
    return <Navigate to="/account/returns" replace />
  }

  const lines = order.lines.filter((l) => l.vendorId === (vendorId || vendors[0][0]) && (left[l.productId] ?? 0) > 0)

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    const next = [...photos]
    for (const f of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) { toast.info(`Only ${MAX_PHOTOS} photos can be added.`); break }
      const r = await prepareImage(f)
      if (r.ok) next.push(r.dataUrl)
      else toast.error(r.error)
    }
    setPhotos(next)
    setBusy(false)
    setError('')
  }

  const submit = () => {
    if (!reason) return setError('Choose the reason for your return.')
    const items = lines.filter((l) => (qty[l.productId] ?? 0) > 0).map((l) => ({ productId: l.productId, qty: qty[l.productId] }))
    const r = create({ orderId: order.id, items, reason, details, photos })
    if (!r.ok) return setError(r.error)
    toast.success('Return requested. The vendor will respond soon.')
    navigate(`/account/returns/${r.data.id}`, { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-3xl space-y-8 py-12 sm:py-16">
        <Link to="/account/returns" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"><ArrowLeft className="h-4 w-4" /> Returns</Link>
        <PageHeader eyebrow={`Order ${order.number}`} title="Start a return" description={`Return by ${formatDate(windowEnd(order)!.toISOString())}. Refunds take ${POLICY.refundProcessingDays}.`} />

        <Card className="space-y-8 p-5 sm:p-7">
          {vendors.length > 1 && (
            <FormField id="r-vendor" label="Which vendor’s items?" hint="Items from different vendors are returned separately.">
              <select id="r-vendor" className={inputClass()} value={vendorId} onChange={(e) => { setVendorId(e.target.value); setQty({}) }} aria-describedby="r-vendor-msg">
                {vendors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </FormField>
          )}

          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">What are you returning?</legend>
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#151b1c]/[0.1] p-4">
                  <span className="min-w-0 text-sm"><strong>{l.name}</strong><span className="block text-xs text-[#151b1c]/45">{formatNaira(l.unitPrice)} each · up to {left[l.productId]}</span></span>
                  <label className="flex items-center gap-2 text-sm">
                    Qty
                    <select className={`${inputClass()} !h-10 !w-20`} value={qty[l.productId] ?? 0} aria-label={`Quantity of ${l.name} to return`} onChange={(e) => { setQty((q) => ({ ...q, [l.productId]: Number(e.target.value) })); setError('') }}>
                      {Array.from({ length: left[l.productId] + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">Why? <span className="text-[#9b302d]">*</span></legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(REASONS) as ReturnReason[]).map((r) => (
                <label key={r} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${reason === r ? 'border-[#151b1c] bg-[#151b1c]/[0.03]' : 'border-[#151b1c]/[0.12] hover:border-[#151b1c]/30'}`}>
                  <input type="radio" name="reason" className="mt-1 accent-[#151b1c]" checked={reason === r} onChange={() => { setReason(r); setError('') }} />
                  <span><span className="block text-sm font-semibold">{REASONS[r].label}</span><span className="block text-xs text-[#151b1c]/50">{REASONS[r].hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <FormField id="r-details" label="Tell us what happened" required hint={reason === 'other' ? 'At least 20 characters.' : 'At least 10 characters.'}>
            <textarea id="r-details" className={textareaClass()} value={details} aria-describedby="r-details-msg" onChange={(e) => { setDetails(e.target.value); setError('') }} />
          </FormField>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">Photos {reason && needsPhotos(reason) ? <span className="text-[#9b302d]">* required for this reason</span> : '(optional)'}</p>
            <ul className="flex flex-wrap gap-3">
              {photos.map((src, i) => (
                <li key={i} className="relative">
                  <img src={src} alt={`Photo ${i + 1}`} className="h-24 w-24 rounded-xl object-cover" />
                  <button type="button" aria-label={`Remove photo ${i + 1}`} className="absolute -right-2 -top-2 rounded-full bg-[#151b1c] p-1.5 text-white" onClick={() => setPhotos(photos.filter((_, n) => n !== i))}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
              {photos.length < MAX_PHOTOS && (
                <li><button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#151b1c]/25 text-xs font-semibold text-[#151b1c]/55 hover:bg-white disabled:opacity-50"><ImagePlus className="h-5 w-5" />{busy ? '…' : 'Add'}</button></li>
              )}
            </ul>
            <input ref={file} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload photos" onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />
          </div>

          <Notice tone="info" title="What happens next">
            The vendor reviews your request. If they decline, you can ask Karta to review it. Once the item is collected and checked, we refund the items{reason && REASONS[reason].fault ? ' (and delivery, if the whole order is returned)' : ''} to your original payment method.
          </Notice>

          {error && <p role="alert" className="text-sm text-[#9b302d]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Link to="/account/returns" className={secondaryBtn}>Cancel</Link>
            <button type="button" className={primaryBtn} onClick={submit}>Submit return request</button>
          </div>
        </Card>
      </div>
    </main>
  )
}

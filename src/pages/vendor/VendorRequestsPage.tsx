import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'

import { Card, EmptyState, FormField, Notice, PageHeader, StatusPill, inputClass, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { LIMITS } from '@/modules/requests/lib'
import RequestSummary, { REQUEST_STATUS } from '@/modules/requests/RequestSummary'
import { useRequestsStore } from '@/modules/requests/requests.store'
import type { CustomRequest } from '@/modules/requests/types'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import { toast } from '@/store/toast.store'

type Tab = 'board' | 'mine'
const digits = (v: string) => v.replace(/\D/g, '')

export default function VendorRequestsPage() {
  useDocumentTitle('Customer requests')

  const { email, workspace } = useVendor()
  const me = email.trim().toLowerCase()
  const approved = workspace.profile.status === 'approved'
  const myCats = workspace.profile.business.categoryIds

  const all = useRequestsStore((s) => s.requests)
  const store = useRequestsStore()
  useEffect(() => store.sweep(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState<Tab>('board')
  const [onlyMine, setOnlyMine] = useState(true)

  const board = useMemo(
    () => all.filter((r) => r.status === 'open' && !r.declinedBy.includes(me) && r.customerEmail !== me && (!onlyMine || !r.categoryId || myCats.includes(r.categoryId))),
    [all, me, onlyMine, myCats],
  )
  const mine = useMemo(() => all.filter((r) => r.offer?.vendorEmail === me || r.declinedBy.includes(me)), [all, me])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Made to order" title="Customer requests" description="Customers describe pieces they can’t find. Send a price and a timeframe. The first vendor to make an offer takes the request, and no one else sees it." />

      {!approved && <Notice tone="warning" title="Verification needed">You can browse requests, but only verified vendors can make offers. Finish your application first.</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Requests" className="flex gap-2">
          {([['board', `Open requests (${board.length})`], ['mine', `My offers (${mine.length})`]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${tab === id ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'}`}>{label}</button>
          ))}
        </div>
        {tab === 'board' && myCats.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-[#151b1c]" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only categories I sell</label>
        )}
      </div>

      {tab === 'board' ? (
        board.length === 0 ? (
          <Card><EmptyState icon={<Sparkles className="h-5 w-5" />} title="No open requests" body={onlyMine ? 'Nothing matches your categories right now. Untick the filter to see everything.' : 'New customer requests appear here.'} /></Card>
        ) : (
          <ul className="space-y-5">{board.map((r) => <li key={r.id}><Card className="p-5 sm:p-6"><RequestSummary r={r} showStatus={false} /><OfferForm r={r} disabled={!approved} /></Card></li>)}</ul>
        )
      ) : mine.length === 0 ? (
        <Card><EmptyState icon={<Sparkles className="h-5 w-5" />} title="No offers yet" body="Requests you make offers on appear here." /></Card>
      ) : (
        <ul className="space-y-5">
          {mine.map((r) => (
            <li key={r.id}>
              <Card className="space-y-4 p-5 sm:p-6">
                <RequestSummary r={r} showStatus={false} />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#151b1c]/[0.04] p-4 text-sm">
                  <span>
                    {r.offer?.vendorEmail === me
                      ? <>Your offer: <strong>{formatNaira(r.offer.price)}</strong> · {r.offer.days} days</>
                      : 'Your earlier offer wasn’t taken, so this request is closed to you.'}
                  </span>
                  {r.offer?.vendorEmail === me ? <StatusPill tone={REQUEST_STATUS[r.status].tone}>{r.status === 'claimed' ? 'Waiting for the customer' : REQUEST_STATUS[r.status].label}</StatusPill> : <StatusPill tone="neutral">Not selected</StatusPill>}
                </div>
                {r.status === 'claimed' && r.offer?.vendorEmail === me && (
                  <div className="flex justify-end"><button type="button" className={secondaryBtn} onClick={() => { const x = store.withdraw(r.id); x.ok ? toast.success('Offer withdrawn') : toast.error(x.error) }}>Withdraw offer</button></div>
                )}
                {r.status === 'accepted' && r.offer?.vendorEmail === me && <p className="text-sm text-[#265041]">The customer accepted. They can now pay, and the order will appear in your Orders.</p>}
                {r.status === 'ordered' && r.offer?.vendorEmail === me && <p className="text-sm text-[#265041]">Paid. Please start making it. Find it in your Orders.</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OfferForm({ r, disabled }: { r: CustomRequest; disabled: boolean }) {
  const offer = useRequestsStore((s) => s.offer)
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const send = () => {
    const x = offer(r.id, { price: Number(price), days: Number(days), note })
    if (!x.ok) return setError(x.error)
    toast.success('Offer sent. This request is now yours while the customer decides.')
  }

  if (!open) return <div className="mt-5 flex justify-end"><button type="button" className={primaryBtn} disabled={disabled} onClick={() => setOpen(true)}>I can make this</button></div>

  return (
    <div className="mt-5 space-y-4 border-t border-[#151b1c]/[0.07] pt-5">
      <Notice tone="warning" title="Making an offer takes this request">No other vendor will see it while the customer decides (up to {LIMITS.offerHours} hours). If they decline, it can’t come back to you.</Notice>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`p-${r.id}`} label="Your price (₦)" required><input id={`p-${r.id}`} inputMode="numeric" className={`${inputClass(!!error)} tabular-nums`} value={price} onChange={(e) => { setPrice(digits(e.target.value)); setError('') }} /></FormField>
        <FormField id={`d-${r.id}`} label="Days to make it" required hint="Before delivery"><input id={`d-${r.id}`} inputMode="numeric" className={inputClass(!!error)} value={days} aria-describedby={`d-${r.id}-msg`} onChange={(e) => { setDays(digits(e.target.value)); setError('') }} /></FormField>
      </div>
      <FormField id={`n-${r.id}`} label="Note to the customer" required error={error} hint="Materials, finish, what’s included. No phone numbers or links.">
        <textarea id={`n-${r.id}`} className={textareaClass(!!error)} maxLength={LIMITS.note[1]} value={note} aria-invalid={error ? true : undefined} aria-describedby={`n-${r.id}-msg`} onChange={(e) => { setNote(e.target.value); setError('') }} />
      </FormField>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryBtn} onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={!price || !days || note.trim().length < LIMITS.note[0]} onClick={send}>Send offer</button>
      </div>
    </div>
  )
}

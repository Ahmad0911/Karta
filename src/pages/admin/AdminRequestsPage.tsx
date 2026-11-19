import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

import { Card, EmptyState, FormField, PageHeader, StatusPill, dangerBtn, inputClass, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAllVendors } from '@/modules/vendors/hooks/useAllVendors'
import RequestSummary, { REQUEST_STATUS, budgetText } from '@/modules/requests/RequestSummary'
import { useRequestsStore } from '@/modules/requests/requests.store'
import type { CustomRequest } from '@/modules/requests/types'
import { useSupportStore } from '@/modules/support/support.store'
import { toast } from '@/store/toast.store'

/**
 * Karta is the only go-between. Customers and vendors never talk directly:
 *  - the customer chats with Karta (support thread, category "request")
 *  - the vendor chats with Karta (a thread started from here, no customer identity)
 *  - staff record the vendor's quote and pass it to the customer
 */
export default function AdminRequestsPage() {
  useDocumentTitle('Custom requests')

  const navigate = useNavigate()
  const all = useRequestsStore((s) => s.requests)
  const remove = useRequestsStore((s) => s.adminRemove)
  const adminOffer = useRequestsStore((s) => s.adminOffer)
  const staffStart = useSupportStore((s) => s.staffStart)
  const vendors = useAllVendors().filter((v) => v.workspace.profile.status === 'approved')

  const [open, setOpen] = useState<{ id: string; mode: 'offer' | 'remove' | 'vendor' } | null>(null)
  const [vendorEmail, setVendorEmail] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const list = useMemo(() => [...all].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [all])

  const reset = () => { setOpen(null); setVendorEmail(''); setPrice(''); setDays(''); setNote(''); setReason(''); setError('') }

  const messageCustomer = (r: CustomRequest) => {
    const t = useSupportStore.getState().tickets.find((x) => x.requestId === r.id && x.requesterRole === 'customer')
    if (t) return navigate('/admin/support')
    const res = staffStart({
      requesterEmail: r.customerEmail, requesterName: r.customerLabel, requesterRole: 'customer', category: 'request', requestId: r.id,
      subject: `Your request ${r.number}: ${r.title}`.slice(0, 120),
      message: `Hi ${r.customerLabel.split(' ')[0]}, this is the Karta team about your request “${r.title}”. We’re looking for the right maker and will update you here. Is there anything you’d like to add or change?`,
    })
    if (!res.ok) return toast.error(res.error)
    toast.success('Conversation started with the customer')
    navigate('/admin/support')
  }

  const messageVendor = (r: CustomRequest) => {
    const v = vendors.find((x) => x.email === vendorEmail)
    if (!v) return setError('Choose a vendor first.')
    const res = staffStart({
      requesterEmail: v.email, requesterName: v.workspace.profile.business.name || v.email, requesterRole: 'vendor', category: 'request',
      subject: `Custom piece ${r.number}: ${r.title}`.slice(0, 120),
      message: [
        `Karta has a custom request that suits you. Please reply here with your price (₦), how many days you need, and any questions.`,
        '',
        `${r.title}`, r.description, '',
        `Budget: ${budgetText(r)}`,
        `Deliver to: ${r.city}, ${r.state}`,
        r.dimensions ? `Size: ${r.dimensions}` : '',
        r.styles.length ? `Style: ${r.styles.join(', ')}` : '',
        r.images.length ? `(${r.images.length} reference image${r.images.length === 1 ? '' : 's'} on file with Karta)` : '',
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').slice(0, 2000),
    })
    if (!res.ok) return setError(res.error)
    toast.success('Message sent to the vendor')
    reset()
    navigate('/admin/support')
  }

  const sendOffer = (id: string) => {
    const res = adminOffer(id, { vendorEmail, price: Number(price), days: Number(days), note })
    if (!res.ok) return setError(res.error)
    toast.success('Offer sent to the customer')
    reset()
  }

  const doRemove = (id: string) => {
    const res = remove(id, reason)
    if (!res.ok) return setError(res.error)
    toast.success('Request removed')
    reset()
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Concierge" title="Custom requests" description="You are the go-between. Message the customer, find a vendor, message the vendor, then enter the vendor’s quote as an offer for the customer. Neither side ever sees the other’s details." />
      {list.length === 0 ? (
        <Card><EmptyState icon={<Sparkles className="h-5 w-5" />} title="No requests yet" body="Customer requests appear here." /></Card>
      ) : (
        <ul className="space-y-5">
          {list.map((r) => {
            const active = open?.id === r.id ? open.mode : null
            const live = !['removed', 'ordered', 'closed'].includes(r.status)
            return (
              <li key={r.id}>
                <Card className="space-y-4 p-5 sm:p-6">
                  <RequestSummary r={r} />
                  <p className="text-xs text-[#151b1c]/50">Customer: {r.customerEmail}</p>
                  {r.offer && <p className="text-sm text-[#151b1c]/60">Quote from <strong>{r.offer.vendorName}</strong>: {formatNaira(r.offer.price)} in {r.offer.days} days</p>}
                  {r.removedReason && <p className="text-sm text-[#9b302d]">Removed: {r.removedReason}</p>}

                  {live && !active && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={secondaryBtn} onClick={() => messageCustomer(r)}>Message customer</button>
                      {r.status === 'open' && <button type="button" className={secondaryBtn} onClick={() => { reset(); setOpen({ id: r.id, mode: 'vendor' }) }}>Message a vendor</button>}
                      {r.status === 'open' && <button type="button" className={primaryBtn} onClick={() => { reset(); setOpen({ id: r.id, mode: 'offer' }) }}>Send offer to customer</button>}
                      <button type="button" className={dangerBtn} onClick={() => { reset(); setOpen({ id: r.id, mode: 'remove' }) }}>Remove…</button>
                    </div>
                  )}

                  {active && active !== 'remove' && (
                    <div className="space-y-4 rounded-2xl bg-[#151b1c]/[0.03] p-4">
                      <FormField id={`v-${r.id}`} label="Vendor" error={error && !vendorEmail ? error : ''}>
                        <select id={`v-${r.id}`} className={inputClass()} value={vendorEmail} onChange={(e) => { setVendorEmail(e.target.value); setError('') }}>
                          <option value="">Choose a verified vendor</option>
                          {vendors.map((v) => <option key={v.email} value={v.email}>{v.workspace.profile.business.name || v.email}</option>)}
                        </select>
                      </FormField>
                      {active === 'offer' && (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField id={`p-${r.id}`} label="Price the customer pays (₦)"><input id={`p-${r.id}`} inputMode="numeric" className={inputClass()} value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, '')); setError('') }} /></FormField>
                            <FormField id={`d-${r.id}`} label="Days to make it"><input id={`d-${r.id}`} inputMode="numeric" className={inputClass()} value={days} onChange={(e) => { setDays(e.target.value.replace(/\D/g, '')); setError('') }} /></FormField>
                          </div>
                          <FormField id={`n-${r.id}`} label="Note for the customer" hint="From Karta. No phone numbers, emails or links."><textarea id={`n-${r.id}`} className={textareaClass()} value={note} onChange={(e) => { setNote(e.target.value); setError('') }} /></FormField>
                        </>
                      )}
                      {error && <p role="alert" className="text-sm text-[#9b302d]">{error}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" className={secondaryBtn} onClick={reset}>Cancel</button>
                        {active === 'offer' ? <button type="button" className={primaryBtn} onClick={() => sendOffer(r.id)}>Send offer</button> : <button type="button" className={primaryBtn} onClick={() => messageVendor(r)}>Send to vendor</button>}
                      </div>
                    </div>
                  )}

                  {active === 'remove' && (
                    <div className="space-y-3">
                      <FormField id={`rm-${r.id}`} label="Reason for removing" error={error}><input id={`rm-${r.id}`} className={inputClass(!!error)} value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} /></FormField>
                      <div className="flex justify-end gap-2"><button type="button" className={secondaryBtn} onClick={reset}>Cancel</button><button type="button" className={dangerBtn} onClick={() => doRemove(r.id)}>Remove request</button></div>
                    </div>
                  )}

                  <div><StatusPill tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</StatusPill></div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

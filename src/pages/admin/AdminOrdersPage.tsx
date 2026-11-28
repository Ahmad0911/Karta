import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Receipt, RefreshCw } from 'lucide-react'

import { Card, EmptyState, FormField, Notice, PageHeader, StatusPill, inputClass, primaryBtn, secondaryBtn } from '@/components/portal/ui'
import { apiGet, apiPost } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { errorText } from '@/store/auth.api'
import { toast } from '@/store/toast.store'

interface AdminOrder {
  id: string
  number: string
  status: string
  totalKobo: number
  refundedKobo: number
  placedAt: string
  customerName?: string
  customerEmail?: string
  paymentReference: string | null
  attention: { kind: string; text: string; refundDueKobo?: number }[]
  fulfilment: { id: string; number: string; status: string; subtotalKobo: number; cancelReason: string | null }[]
}

const STEP: Record<string, string> = {
  new: 'Received', confirmed: 'Confirmed', packing: 'Packing', ready_for_pickup: 'Ready for pickup',
  with_logistics: 'On the way', delivered: 'Delivered', cancelled: 'Declined',
}
const naira = (kobo: number) => formatNaira(Math.round(kobo / 100))

/** Every paid order, what needs attention, and the refund form. Staff only. */
export default function AdminOrdersPage() {
  useDocumentTitle('Orders and refunds')

  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'attention' | 'all'>('attention')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setOrders((await apiGet<{ orders: AdminOrder[] }>('/admin/orders')).orders)
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const needs = (o: AdminOrder) => o.attention.length > 0
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (orders ?? [])
      .filter((o) => (view === 'all' || needs(o)))
      .filter((o) => !q || o.number.toLowerCase().includes(q) || (o.customerEmail ?? '').toLowerCase().includes(q) || (o.customerName ?? '').toLowerCase().includes(q))
  }, [orders, view, search])
  const attentionCount = (orders ?? []).filter(needs).length

  const openRefund = (o: AdminOrder) => {
    const due = o.attention.find((a) => a.refundDueKobo)?.refundDueKobo
    const remaining = o.totalKobo - o.refundedKobo
    setOpen(o.id); setAmount(String(Math.round(Math.min(due ?? remaining, remaining) / 100))); setNote(''); setFormError('')
  }

  const refund = async (o: AdminOrder) => {
    const kobo = Math.round(Number(amount) * 100)
    const remaining = o.totalKobo - o.refundedKobo
    if (!o.paymentReference) return setFormError('This order has no confirmed payment to refund.')
    if (!Number.isFinite(kobo) || kobo < 100) return setFormError('Enter an amount of at least ₦1.')
    if (kobo > remaining) return setFormError(`The most you can refund is ${naira(remaining)}.`)
    if (note.trim().length < 5) return setFormError('Add a short reason (at least 5 characters). The customer may see it.')
    setBusy(true); setFormError('')
    try {
      const r = await apiPost<{ status: string }>('/payments/refund', { reference: o.paymentReference, amountKobo: kobo, note: note.trim() })
      toast.success(r.status === 'completed' ? `Refunded ${naira(kobo)}` : `Refund of ${naira(kobo)} sent to Paystack. It will complete shortly.`)
      setOpen(null)
      await load()
    } catch (e) {
      setFormError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payments"
        title="Orders and refunds"
        description="Every paid order. Orders that need you come first: a vendor declined, an item sold out, or a customer paid twice. A refund goes back to the customer’s card through Paystack."
        actions={<button type="button" onClick={() => void load()} className={secondaryBtn}><RefreshCw className="mr-2 h-4 w-4" />Refresh</button>}
      />

      {error && <Notice tone="warning" title="Couldn’t load orders">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {([['attention', `Needs attention${attentionCount ? ` (${attentionCount})` : ''}`], ['all', 'All paid orders']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${view === id ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/10 bg-white text-[#151b1c]/55 hover:border-[#151b1c]/25'}`}>{label}</button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find by order number or customer" aria-label="Find an order" className={`${inputClass()} max-w-xs`} />
      </div>

      {orders === null && !error ? (
        <p className="py-12 text-center text-sm text-[#151b1c]/55">Loading…</p>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={<Receipt className="h-5 w-5" />} title={view === 'attention' ? 'Nothing needs attention' : 'No orders found'} body={view === 'attention' ? 'Orders that need a refund or a second look will appear here.' : 'Paid orders appear here.'} /></Card>
      ) : (
        <ul className="space-y-4">
          {list.map((o) => {
            const remaining = o.totalKobo - o.refundedKobo
            return (
              <li key={o.id}>
                <Card className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl tracking-tight">{o.number}</p>
                      <p className="mt-0.5 text-xs text-[#151b1c]/50">{o.customerName} · {o.customerEmail} · {formatDate(o.placedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{naira(o.totalKobo)}</p>
                      {o.refundedKobo > 0 && <p className="text-xs text-[#9b302d]">Refunded {naira(o.refundedKobo)}</p>}
                    </div>
                  </div>

                  {o.attention.map((a, i) => (
                    <p key={i} className="flex items-start gap-2 rounded-xl bg-[#c98a2b]/10 px-4 py-3 text-sm text-[#7a5412]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{a.text}</p>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    {o.fulfilment.map((f) => (
                      <StatusPill key={f.id} tone={f.status === 'delivered' ? 'green' : f.status === 'cancelled' ? 'red' : 'blue'}>{f.number}: {STEP[f.status] ?? f.status}</StatusPill>
                    ))}
                  </div>
                  {o.fulfilment.filter((f) => f.cancelReason).map((f) => (
                    <p key={f.id} className="text-xs text-[#151b1c]/55">Vendor’s reason for declining {f.number}: {f.cancelReason}</p>
                  ))}

                  {open === o.id ? (
                    <div className="space-y-4 rounded-2xl bg-[#151b1c]/[0.03] p-4">
                      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                        <FormField id={`a-${o.id}`} label="Amount to refund (₦)" hint={`Up to ${naira(remaining)}`}>
                          <input id={`a-${o.id}`} inputMode="numeric" className={inputClass()} value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, '')); setFormError('') }} />
                        </FormField>
                        <FormField id={`n-${o.id}`} label="Reason" hint="Recorded with the refund.">
                          <input id={`n-${o.id}`} className={inputClass()} value={note} onChange={(e) => { setNote(e.target.value); setFormError('') }} placeholder="e.g. Vendor declined the order" />
                        </FormField>
                      </div>
                      {formError && <p role="alert" className="text-sm text-[#9b302d]">{formError}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" className={secondaryBtn} onClick={() => setOpen(null)}>Cancel</button>
                        <button type="button" className={primaryBtn} disabled={busy} onClick={() => void refund(o)}>{busy ? 'Refunding…' : 'Refund customer'}</button>
                      </div>
                    </div>
                  ) : remaining > 0 && o.paymentReference ? (
                    <div className="flex justify-end"><button type="button" className={secondaryBtn} onClick={() => openRefund(o)}>Refund…</button></div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

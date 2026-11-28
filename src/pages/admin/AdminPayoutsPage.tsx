import { useCallback, useEffect, useState } from 'react'
import { Landmark, RefreshCw, Wallet } from 'lucide-react'

import { Card, CardHeader, EmptyState, FormField, Notice, PageHeader, StatCard, StatusPill, dangerBtn, inputClass, primaryBtn, secondaryBtn } from '@/components/portal/ui'
import { apiGet, apiPost } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { errorText } from '@/store/auth.api'
import { toast } from '@/store/toast.store'

interface Due {
  vendorId: string
  vendorName: string
  vendorEmail?: string
  bank: { bankName: string; accountNumber: string; accountName: string } | null
  amountKobo: number
  orders: { number: string; netKobo: number; deliveredAt: string }[]
  heldForReview: { number: string; netKobo: number; reason: string }[]
  canPay: boolean
}
interface Payout {
  id: string; reference: string; amountKobo: number; status: 'pending' | 'paid' | 'cancelled'; bankLabel: string; vendorName: string
  accountNumber: string; accountName: string; transferRef: string | null; note: string | null; createdAt: string; paidAt: string | null; orderIds: string[]
}
const naira = (kobo: number) => formatNaira(Math.round(kobo / 100))

/**
 * Pay vendors. Karta staff send the money from the bank (or Paystack dashboard), then record the transfer reference
 * here. Nothing on this page moves money by itself.
 */
export default function AdminPayoutsPage() {
  useDocumentTitle('Vendor payouts')

  const [due, setDue] = useState<{ holdDays: number; vendors: Due[] } | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [paying, setPaying] = useState<{ id: string; mode: 'paid' | 'cancel' } | null>(null)
  const [text, setText] = useState('')
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([apiGet<{ holdDays: number; vendors: Due[] }>('/admin/payouts/due'), apiGet<{ payouts: Payout[] }>('/admin/payouts')])
      setDue(d); setPayouts(p.payouts); setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const create = async (v: Due) => {
    setBusy(v.vendorId)
    try {
      const p = await apiPost<Payout>('/admin/payouts', { vendorId: v.vendorId })
      toast.success(`Payout ${p.reference} created. Send ${naira(p.amountKobo)}, then record the transfer reference.`)
      await load()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const submit = async (p: Payout) => {
    if (!paying) return
    const cancelling = paying.mode === 'cancel'
    if (text.trim().length < (cancelling ? 5 : 4)) return setFormError(cancelling ? 'Add a short reason.' : 'Enter the transfer reference from your bank or Paystack.')
    setBusy(p.id); setFormError('')
    try {
      await apiPost(`/admin/payouts/${p.id}/${cancelling ? 'cancel' : 'paid'}`, cancelling ? { reason: text.trim() } : { transferRef: text.trim() })
      toast.success(cancelling ? `${p.reference} cancelled` : `${p.reference} recorded as paid`)
      setPaying(null); setText('')
      await load()
    } catch (e) {
      setFormError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const pending = payouts.filter((p) => p.status === 'pending')
  const totalDue = (due?.vendors ?? []).reduce((s, v) => s + (v.canPay ? v.amountKobo : 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance"
        title="Vendor payouts"
        description={`Earnings become payable ${due?.holdDays ?? 7} days after delivery, once the return window has closed. Create a payout, send the money from your bank, then record the transfer reference.`}
        actions={<button type="button" onClick={() => void load()} className={secondaryBtn}><RefreshCw className="mr-2 h-4 w-4" />Refresh</button>}
      />
      {error && <Notice tone="warning" title="Couldn’t load payouts">{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ready to pay" value={naira(totalDue)} hint={`${(due?.vendors ?? []).filter((v) => v.canPay).length} vendors`} />
        <StatCard label="Waiting for transfer" value={naira(pending.reduce((s, p) => s + p.amountKobo, 0))} hint={`${pending.length} payouts`} />
        <StatCard label="Paid to date" value={naira(payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountKobo, 0))} />
      </div>

      {/* ------------------------------- pending ------------------------------- */}
      {pending.length > 0 && (
        <Card>
          <CardHeader title="Waiting for you to send the money" description="Send exactly this amount to the account shown, then record the reference." />
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {pending.map((p) => (
              <li key={p.id} className="space-y-3 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{p.reference} · {p.vendorName}</p>
                  <p className="text-lg font-semibold tabular-nums">{naira(p.amountKobo)}</p>
                </div>
                <p className="rounded-xl bg-[#f7f4ee] px-4 py-3 text-sm"><Landmark className="mr-2 inline h-4 w-4 text-[#8f7651]" />{p.bankLabel.split(' ')[0]} · <strong className="tabular-nums">{p.accountNumber}</strong> · {p.accountName}</p>
                {paying?.id === p.id ? (
                  <div className="space-y-3">
                    <FormField id={`t-${p.id}`} label={paying.mode === 'paid' ? 'Transfer reference' : 'Reason for cancelling'} error={formError}>
                      <input id={`t-${p.id}`} className={inputClass(!!formError)} value={text} onChange={(e) => { setText(e.target.value); setFormError('') }} placeholder={paying.mode === 'paid' ? 'From your bank or Paystack receipt' : 'e.g. Wrong account details'} />
                    </FormField>
                    <div className="flex justify-end gap-2">
                      <button type="button" className={secondaryBtn} onClick={() => { setPaying(null); setText(''); setFormError('') }}>Back</button>
                      <button type="button" disabled={busy === p.id} className={paying.mode === 'paid' ? primaryBtn : dangerBtn} onClick={() => void submit(p)}>{paying.mode === 'paid' ? 'Mark as paid' : 'Cancel payout'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button type="button" className={secondaryBtn} onClick={() => { setPaying({ id: p.id, mode: 'cancel' }); setText(''); setFormError('') }}>Cancel…</button>
                    <button type="button" className={primaryBtn} onClick={() => { setPaying({ id: p.id, mode: 'paid' }); setText(''); setFormError('') }}>I’ve sent the money</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --------------------------------- due ---------------------------------- */}
      <Card>
        <CardHeader title="Due now" description="Delivered orders past the return window, not yet paid out." />
        {!due ? (
          !error && <p className="px-5 py-8 text-center text-sm text-[#151b1c]/55">Loading…</p>
        ) : due.vendors.length === 0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title="Nothing is due" body="Vendors appear here once a delivered order has passed its return window." />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {due.vendors.map((v) => (
              <li key={v.vendorId} className="space-y-3 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{v.vendorName}</p>
                    <p className="text-xs text-[#151b1c]/50">{v.orders.length} order{v.orders.length === 1 ? '' : 's'} · {v.vendorEmail}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-semibold tabular-nums">{naira(v.amountKobo)}</p>
                    <button type="button" className={primaryBtn} disabled={!v.canPay || busy === v.vendorId} onClick={() => void create(v)}>{busy === v.vendorId ? 'Creating…' : 'Create payout'}</button>
                  </div>
                </div>
                {!v.bank && <p className="text-sm text-[#9b302d]">This vendor has no complete bank account on file. Ask them to add one before you can pay.</p>}
                {v.bank && <p className="text-xs text-[#151b1c]/50">{v.bank.bankName} · {v.bank.accountNumber} · {v.bank.accountName}</p>}
                {v.heldForReview.map((h) => <p key={h.number} className="rounded-xl bg-[#c98a2b]/10 px-4 py-2 text-xs text-[#7a5412]">{h.number} ({naira(h.netKobo)}) is held: {h.reason}</p>)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ------------------------------- history ------------------------------- */}
      <Card>
        <CardHeader title="Payout history" />
        {payouts.length === 0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title="No payouts yet" body="Payouts you create appear here." />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
                <span className="w-24 text-sm font-semibold">{p.reference}</span>
                <span className="flex-1 text-xs text-[#151b1c]/50">{p.vendorName} · {p.bankLabel} · {p.orderIds.length} order{p.orderIds.length === 1 ? '' : 's'}{p.transferRef ? ` · ref ${p.transferRef}` : ''} · {formatDate(p.paidAt ?? p.createdAt)}</span>
                <span className="text-sm font-medium tabular-nums">{naira(p.amountKobo)}</span>
                <StatusPill tone={p.status === 'paid' ? 'green' : p.status === 'pending' ? 'amber' : 'neutral'}>{p.status === 'paid' ? 'Paid' : p.status === 'pending' ? 'Waiting' : 'Cancelled'}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

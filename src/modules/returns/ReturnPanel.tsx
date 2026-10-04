import { useState } from 'react'

import { Card, FormField, StatusPill, dangerBtn, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { POLICY } from '@/config/company'
import { formatDateTime } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { toast } from '@/store/toast.store'
import { REASONS, STATUS_META, computeRefund } from './lib'
import { useReturnsStore } from './returns.store'
import type { ReturnRequest } from './types'

export type Viewer = 'customer' | 'vendor' | 'admin'
type Mode = 'none' | 'reject' | 'escalate' | 'dismiss' | 'uphold'

const NOTE_TITLE: Record<Exclude<Mode, 'none'>, string> = {
  reject: 'Why are you declining? (the customer will see this)',
  escalate: 'Why do you disagree with the vendor?',
  dismiss: 'Reason for dismissing (both sides will see this)',
  uphold: 'Reason for approving (both sides will see this)',
}

/** One return request, with the actions the current viewer is allowed to take. */
export default function ReturnPanel({ ret, viewer }: { ret: ReturnRequest; viewer: Viewer }) {
  const store = useReturnsStore()
  const all = useReturnsStore((s) => s.returns)
  const order = useOrdersStore((s) => s.orders.find((o) => o.id === ret.orderId))

  const [mode, setMode] = useState<Mode>('none')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const meta = STATUS_META[ret.status]
  const itemsTotal = ret.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
  const quote = order && ret.status === 'received' ? computeRefund(order, ret, all) : null

  const done = (message: string) => {
    toast.success(message)
    setMode('none')
    setNote('')
    setError('')
  }
  const fail = (e: string) => setError(e)

  const submitNote = () => {
    if (mode === 'reject') {
      const r = store.vendorDecide(ret.id, 'reject', note)
      return r.ok ? done('Return declined') : fail(r.error)
    }
    if (mode === 'escalate') {
      const r = store.escalate(ret.id, note)
      return r.ok ? done('Sent to Karta. We’ll review it.') : fail(r.error)
    }
    if (mode === 'dismiss' || mode === 'uphold') {
      const r = store.adminDecide(ret.id, mode, note)
      return r.ok ? done(mode === 'uphold' ? 'Return approved' : 'Return dismissed') : fail(r.error)
    }
  }

  const refund = async () => {
    setBusy(true)
    const r = await store.issueRefund(ret.id)
    setBusy(false)
    if (r.ok) toast.success('Refund issued')
    else toast.error(r.error)
  }

  const quick = (fn: () => { ok: boolean; error?: string }, msg: string) => {
    const r = fn()
    if (r.ok) toast.success(msg)
    else toast.error(r.error ?? 'Something went wrong.')
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#151b1c]/[0.07] px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f7651]">{ret.number} · Order {ret.orderNumber}</p>
          <h3 className="mt-1 font-display text-xl tracking-[-0.02em]">{REASONS[ret.reason].label}</h3>
          <p className="text-xs text-[#151b1c]/45">{ret.customerLabel} · {formatDateTime(ret.createdAt)}</p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <ul className="divide-y divide-[#151b1c]/[0.06] text-sm">
          {ret.lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-4 py-2">
              <span>{l.name} <span className="text-[#151b1c]/45">× {l.qty}</span><span className="block text-xs text-[#151b1c]/40">{l.vendorName}</span></span>
              <span className="tabular-nums">{formatNaira(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm leading-6 text-[#151b1c]/75">“{ret.details}”</p>

        {ret.photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {ret.photos.map((src, i) => (
              <li key={i}><img src={src} alt={`Evidence photo ${i + 1}`} className="h-20 w-20 rounded-lg bg-[#eae5db] object-cover" /></li>
            ))}
          </ul>
        )}

        {ret.vendorNote && <p className="rounded-xl bg-[#151b1c]/[0.04] p-3 text-sm"><strong>Vendor:</strong> {ret.vendorNote}</p>}
        {ret.customerNote && <p className="rounded-xl bg-[#151b1c]/[0.04] p-3 text-sm"><strong>Customer’s appeal:</strong> {ret.customerNote}</p>}
        {ret.adminNote && <p className="rounded-xl bg-[#151b1c]/[0.04] p-3 text-sm"><strong>Karta decision:</strong> {ret.adminNote}</p>}

        {ret.refund && (
          <p className="rounded-xl bg-[#315d4b]/[0.08] p-3 text-sm text-[#265041]">
            <strong>{formatNaira(ret.refund.amount)}</strong> {ret.refund.status === 'pending' ? 'is being refunded' : 'refunded'}{ret.refund.includesDelivery ? ' (includes the delivery fee)' : ''}.
            {viewer === 'customer' && <> It can take {POLICY.refundProcessingDays} to show in your account.</>}
          </p>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-[#8a6540]">History</summary>
          <ol className="mt-3 space-y-2">
            {ret.events.map((e) => (
              <li key={e.id} className="text-xs text-[#151b1c]/60">
                <strong className="text-[#151b1c]">{e.action}</strong> · {e.by} · {formatDateTime(e.at)}
                {e.note && <span className="block">{e.note}</span>}
              </li>
            ))}
          </ol>
        </details>
      </div>

      {/* ------------------------------ Actions ------------------------------ */}
      <ActionBar>
        {mode !== 'none' ? (
          <div className="w-full space-y-3">
            <FormField id={`note-${ret.id}`} label={NOTE_TITLE[mode]} required error={error}>
              <textarea id={`note-${ret.id}`} className={textareaClass(!!error)} value={note} aria-invalid={error ? true : undefined} aria-describedby={`note-${ret.id}-msg`} onChange={(e) => { setNote(e.target.value); setError('') }} />
            </FormField>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => { setMode('none'); setError('') }}>Cancel</button>
              <button type="button" className={mode === 'uphold' ? primaryBtn : dangerBtn} onClick={submitNote}>Confirm</button>
            </div>
          </div>
        ) : (
          <>
            {viewer === 'customer' && ret.status === 'requested' && <button type="button" className={secondaryBtn} onClick={() => quick(() => store.cancel(ret.id), 'Return cancelled')}>Cancel request</button>}
            {viewer === 'customer' && ret.status === 'rejected' && <button type="button" className={primaryBtn} onClick={() => { setMode('escalate'); setNote('') }}>Ask Karta to review</button>}

            {viewer === 'vendor' && ret.status === 'requested' && (
              <>
                <button type="button" className={dangerBtn} onClick={() => { setMode('reject'); setNote('') }}>Decline</button>
                <button type="button" className={primaryBtn} onClick={() => quick(() => store.vendorDecide(ret.id, 'approve', ''), 'Return approved')}>Approve return</button>
              </>
            )}

            {viewer === 'admin' && ret.status === 'escalated' && (
              <>
                <button type="button" className={dangerBtn} onClick={() => { setMode('dismiss'); setNote('') }}>Dismiss</button>
                <button type="button" className={primaryBtn} onClick={() => { setMode('uphold'); setNote('') }}>Approve for customer</button>
              </>
            )}
            {viewer === 'admin' && ret.status === 'approved' && <button type="button" className={primaryBtn} onClick={() => quick(() => store.markReceived(ret.id), 'Marked as received')}>Item received</button>}
            {viewer === 'admin' && ret.status === 'received' && (
              <>
                {quote && <span className="mr-auto text-sm">Refund <strong>{formatNaira(quote.amount)}</strong>{quote.includesDelivery ? ' (incl. delivery)' : ''}</span>}
                <button type="button" className={primaryBtn} disabled={busy} onClick={refund}>{busy ? 'Refunding…' : 'Issue refund'}</button>
              </>
            )}

            {!hasAction(viewer, ret) && <span className="text-xs text-[#151b1c]/40">{waitingText(viewer, ret)} · Items value {formatNaira(itemsTotal)}</span>}
          </>
        )}
      </ActionBar>
    </Card>
  )
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#151b1c]/[0.07] bg-[#151b1c]/[0.02] px-5 py-4 sm:px-6">{children}</div>
}

function hasAction(v: Viewer, r: ReturnRequest) {
  return (
    (v === 'customer' && (r.status === 'requested' || r.status === 'rejected')) ||
    (v === 'vendor' && r.status === 'requested') ||
    (v === 'admin' && ['escalated', 'approved', 'received'].includes(r.status))
  )
}

function waitingText(v: Viewer, r: ReturnRequest) {
  if (r.status === 'refunded' || r.status === 'closed') return 'Finished'
  if (v === 'customer') return r.status === 'escalated' ? 'Karta is reviewing' : r.status === 'approved' ? 'Waiting for the item to be collected' : r.status === 'received' ? 'Your refund is being prepared' : 'In progress'
  if (v === 'vendor') return r.status === 'rejected' ? 'Customer may appeal to Karta' : 'Karta is handling the next step'
  return 'Waiting on the customer or vendor'
}

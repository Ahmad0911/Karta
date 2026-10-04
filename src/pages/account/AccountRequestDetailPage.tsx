import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'

import { Card, CardHeader, Notice, StatusPill, dangerBtn, primaryBtn, secondaryBtn } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/date'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import RequestSummary from '@/modules/requests/RequestSummary'
import { useRequestsStore } from '@/modules/requests/requests.store'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

export default function AccountRequestDetailPage() {
  const { id } = useParams()
  const me = useAuthStore((s) => s.user)!.email.trim().toLowerCase()
  const r = useRequestsStore((s) => s.requests.find((x) => x.id === id))
  const store = useRequestsStore()
  const [now, setNow] = useState(Date.now())

  useDocumentTitle(r ? r.number : 'Request')
  useEffect(() => { store.sweep(); const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Someone else’s request looks exactly like a missing one.
  if (!r || r.customerEmail !== me) return <Navigate to="/account/requests" replace />

  const o = r.offer
  const hoursLeft = o ? Math.max(0, Math.ceil((+new Date(o.expiresAt) - now) / 3_600_000)) : 0
  const act = (fn: () => { ok: boolean; error?: string }, msg: string) => { const x = fn(); x.ok ? toast.success(msg) : toast.error(x.error ?? 'Something went wrong.') }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-3xl space-y-6 py-12 sm:py-16">
        <Link to="/account/requests" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"><ArrowLeft className="h-4 w-4" /> All requests</Link>

        <Card className="p-5 sm:p-7"><RequestSummary r={r} /></Card>

        {r.status === 'open' && <Notice tone="info" title="Waiting for a vendor">Verified vendors can see your request now. You’ll get an offer here, with a price and a timeframe.</Notice>}
        {r.status === 'removed' && <Notice tone="danger" title="This request was removed">{r.removedReason}</Notice>}

        {o && (r.status === 'claimed' || r.status === 'accepted' || r.status === 'ordered') && (
          <Card>
            <CardHeader title="Offer" description={`From ${o.vendorName}`} action={<StatusPill tone="blue">{r.status === 'claimed' ? 'Awaiting your answer' : 'Accepted'}</StatusPill>} />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-end gap-x-10 gap-y-2">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40">Price</p><p className="font-display text-4xl tracking-[-0.03em]">{formatNaira(o.price)}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40">Ready in</p><p className="font-display text-4xl tracking-[-0.03em]">{o.days} days</p></div>
              </div>
              <p className="text-sm leading-6 text-[#151b1c]/70">“{o.note}”</p>
              <p className="text-xs text-[#151b1c]/45">Delivery time is extra and shown at checkout. <Link to={`/vendors/${o.vendorId}`} className="underline underline-offset-4">View {o.vendorName}</Link></p>

              {r.status === 'claimed' && (
                <>
                  <p className="flex items-center gap-2 text-sm text-[#8a5a14]"><Clock aria-hidden="true" className="h-4 w-4" /> {hoursLeft > 0 ? `Please answer within ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}. After that the request opens to other vendors.` : 'This offer is about to expire.'}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className={dangerBtn} onClick={() => act(() => store.respond(r.id, 'decline'), 'Offer declined. Your request is open again.')}>Decline</button>
                    <button type="button" className={primaryBtn} onClick={() => act(() => store.respond(r.id, 'accept'), 'Offer accepted. You can now buy it.')}>Accept offer</button>
                  </div>
                </>
              )}

              {r.status === 'accepted' && o.listingId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#315d4b]/[0.08] p-4">
                  <p className="text-sm text-[#265041]">Your piece is reserved for you. Pay to start production.</p>
                  <Link to={`/product/${o.listingId}`} className={primaryBtn}>Go to the piece</Link>
                </div>
              )}
              {r.status === 'ordered' && <Notice tone="success" title="Paid. Production has started.">Track it in <Link to="/account/orders" className="font-semibold underline underline-offset-4">your orders</Link>.</Notice>}
            </div>
          </Card>
        )}

        {['open', 'claimed', 'accepted'].includes(r.status) && (
          <div className="flex justify-end"><button type="button" className={secondaryBtn} onClick={() => { if (window.confirm('Close this request? Vendors will no longer see it.')) act(() => store.close(r.id), 'Request closed') }}>Close request</button></div>
        )}

        <details className="text-sm"><summary className="cursor-pointer text-xs font-semibold text-[#8a6540]">History</summary>
          <ol className="mt-3 space-y-2">{r.events.map((e) => <li key={e.id} className="text-xs text-[#151b1c]/60"><strong className="text-[#151b1c]">{e.action}</strong> · {e.by} · {formatDateTime(e.at)}{e.note && <span className="block">{e.note}</span>}</li>)}</ol>
        </details>
      </div>
    </main>
  )
}

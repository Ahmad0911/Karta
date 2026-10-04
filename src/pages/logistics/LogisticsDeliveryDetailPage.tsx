import { useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  Check,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  X,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  FormField,
  Notice,
  PageHeader,
  StatusPill,
  dangerBtn,
  inputClass,
  primaryBtn,
  secondaryBtn,
  textareaClass,
} from '@/components/portal/ui'
import { formatDateTime } from '@/lib/date'
import { prepareImage } from '@/lib/images'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import { useLogistics } from '@/modules/logistics/hooks/useLogistics'
import {
  DELIVERY_META,
  FAILURE_LABEL,
  NEXT_STEP,
  TIMELINE,
  canComplete,
  canFail,
  mapsLink,
  telLink,
  whatsappTo,
} from '@/modules/logistics/lib/deliveries'
import { useLogisticsStore } from '@/modules/logistics/store/logistics.store'
import type { FailureReason } from '@/modules/logistics/types'

type Mode = 'none' | 'complete' | 'fail'

const linkBtn =
  'inline-flex h-9 items-center gap-2 rounded-full border border-[#151b1c]/15 bg-white/70 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#151b1c]/75 transition hover:border-[#151b1c]/30 hover:bg-white'

export default function LogisticsDeliveryDetailPage() {
  const { id } = useParams()
  const { email, deliveries } = useLogistics()

  const advance = useLogisticsStore((s) => s.advance)
  const complete = useLogisticsStore((s) => s.complete)
  const fail = useLogisticsStore((s) => s.fail)

  const d = deliveries.find((x) => x.id === id)
  useDocumentTitle(d ? `Delivery ${d.orderNumber}` : 'Delivery')

  const [mode, setMode] = useState<Mode>('none')

  // Proof of delivery form
  const [code, setCode] = useState('')
  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)

  // Failed attempt form
  const [reason, setReason] = useState<FailureReason>('customer_unreachable')
  const [failNote, setFailNote] = useState('')

  if (!d) return <Navigate to="/logistics/deliveries" replace />

  const meta = DELIVERY_META[d.status]
  const next = NEXT_STEP[d.status]
  const reached = new Set(d.events.map((e) => e.status))

  const doAdvance = () => {
    const r = advance(email, d.id)
    if (r.ok) toast.success(next ? `${meta.label} → ${DELIVERY_META[next.to].label}` : 'Updated')
    else toast.error(r.error)
  }

  const pickPhoto = async (file?: File) => {
    if (!file) return
    setBusy(true)
    const r = await prepareImage(file)
    setBusy(false)
    if (r.ok) setPhoto(r.dataUrl)
    else toast.error(r.error)
  }

  const submitComplete = () => {
    const r = complete(email, d.id, { code, recipientName: recipient, note, photo })
    if (!r.ok) {
      setFormError(r.error)
      return
    }
    toast.success('Delivery completed. Great work.')
    setMode('none')
  }

  const submitFail = () => {
    const r = fail(email, d.id, reason, failNote)
    if (!r.ok) {
      setFormError(r.error)
      return
    }
    toast.info('Failed attempt recorded. Operations has been notified.')
    setMode('none')
  }

  const openMode = (m: Mode) => {
    setFormError('')
    setMode(m)
  }

  return (
    <div className="space-y-8">
      <Link
        to="/logistics/deliveries"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"
      >
        <ArrowLeft className="h-4 w-4" /> All deliveries
      </Link>

      <PageHeader
        eyebrow={`Scheduled ${d.scheduledFor}`}
        title={`Delivery ${d.orderNumber}`}
        description={d.attempts > 0 ? `${d.attempts} previous attempt${d.attempts === 1 ? '' : 's'}` : undefined}
        actions={<StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
      />

      {d.handlingNote && (
        <Notice tone="warning" title="Handling note">
          {d.handlingNote}
        </Notice>
      )}

      {d.status === 'failed' && d.failureReason && (
        <Notice tone="danger" title={`Last attempt failed: ${FAILURE_LABEL[d.failureReason]}`}>
          {d.failureNote}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------ Pickup ------------------------------ */}
        <Card>
          <CardHeader title="Pick up from" />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div>
              <p className="text-sm font-semibold">{d.vendorName}</p>
              <p className="mt-1 flex items-start gap-2 text-sm text-[#151b1c]/60">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8f7651]" />
                {d.pickupAddress}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={telLink(d.pickupPhone)} className={linkBtn}>
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a href={mapsLink(d.pickupAddress)} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                <Navigation className="h-3.5 w-3.5" /> Directions
              </a>
            </div>
          </div>
        </Card>

        {/* ------------------------------ Drop-off ---------------------------- */}
        <Card>
          <CardHeader title="Deliver to" />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div>
              <p className="text-sm font-semibold">{d.customerName}</p>
              <p className="mt-1 flex items-start gap-2 text-sm text-[#151b1c]/60">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8f7651]" />
                {d.dropoffAddress}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={telLink(d.customerPhone)} className={linkBtn}>
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a
                href={whatsappTo(
                  d.customerPhone,
                  `Hello ${d.customerName.split(' ')[0]}, I'm your Karta delivery driver for order ${d.orderNumber}. I'm on my way.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={linkBtn}
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a href={mapsLink(d.dropoffAddress)} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                <Navigation className="h-3.5 w-3.5" /> Directions
              </a>
            </div>
          </div>
        </Card>
      </div>

      {/* -------------------------------- Items ------------------------------- */}
      <Card>
        <CardHeader title="Items" />
        <ul className="divide-y divide-[#151b1c]/[0.07]">
          {d.items.map((item) => (
            <li key={item} className="flex items-center gap-3 px-5 py-3.5 text-sm sm:px-6">
              <Package aria-hidden="true" className="h-4 w-4 text-[#8f7651]" />
              {item}
            </li>
          ))}
        </ul>
        {d.assemblyRequested && (
          <p className="border-t border-[#151b1c]/[0.07] px-5 py-3.5 text-xs text-[#151b1c]/55 sm:px-6">
            Customer requested professional assembly. Coordinate with the assembly team on arrival.
          </p>
        )}
      </Card>

      {/* ------------------------------- Actions ------------------------------ */}
      {d.status !== 'delivered' && (
        <Card className="p-5 sm:p-6">
          {mode === 'none' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#151b1c]/60">
                {canComplete(d.status) ? 'You’re with the customer. Complete or report.' : 'Next step'}
              </p>

              <div className="flex flex-wrap gap-2">
                {canFail(d.status) && (
                  <button type="button" className={dangerBtn} onClick={() => openMode('fail')}>
                    Report problem
                  </button>
                )}

                {next && (
                  <button type="button" className={primaryBtn} onClick={doAdvance}>
                    <Check className="h-4 w-4" /> {next.label}
                  </button>
                )}

                {canComplete(d.status) && (
                  <button type="button" className={primaryBtn} onClick={() => openMode('complete')}>
                    <Check className="h-4 w-4" /> Complete delivery
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === 'complete' && (
            <div className="space-y-5">
              <h2 className="font-display text-xl tracking-[-0.02em]">Proof of delivery</h2>

              {formError && (
                <p role="alert" className="rounded-xl border border-[#9b302d]/25 bg-[#9b302d]/[0.05] px-4 py-3 text-sm text-[#8a2724]">
                  {formError}
                </p>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="pod-code"
                  label="Customer’s delivery code"
                  required
                  hint="The 4-digit code the customer received by SMS."
                >
                  <input
                    id="pod-code"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                    aria-describedby="pod-code-msg"
                    className={`${inputClass()} text-center text-lg tabular-nums tracking-[0.5em]`}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                      setFormError('')
                    }}
                  />
                </FormField>

                <FormField id="pod-name" label="Received by" required>
                  <input
                    id="pod-name"
                    className={inputClass()}
                    value={recipient}
                    placeholder={d.customerName}
                    onChange={(e) => {
                      setRecipient(e.target.value)
                      setFormError('')
                    }}
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <FormField id="pod-note" label="Note (optional)">
                    <textarea
                      id="pod-note"
                      className={`${textareaClass()} !min-h-[5rem]`}
                      value={note}
                      placeholder="Condition on arrival, where it was placed…"
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </FormField>
                </div>

                <div className="sm:col-span-2">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">
                    Photo of delivered item (recommended)
                  </p>

                  {photo ? (
                    <div className="relative inline-block">
                      <img src={photo} alt="Delivered item" className="h-32 w-32 rounded-xl object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhoto(undefined)}
                        aria-label="Remove photo"
                        className="absolute -right-2 -top-2 rounded-full bg-[#151b1c] p-1.5 text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={secondaryBtn}
                      disabled={busy}
                      onClick={() => photoInput.current?.click()}
                    >
                      <Camera className="h-4 w-4" /> {busy ? 'Preparing…' : 'Take or choose photo'}
                    </button>
                  )}

                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    aria-label="Photo of delivered item"
                    onChange={(e) => {
                      void pickPhoto(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={secondaryBtn} onClick={() => setMode('none')}>
                  Back
                </button>
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={code.length !== 4 || recipient.trim().length < 2}
                  onClick={submitComplete}
                >
                  Confirm delivery
                </button>
              </div>
            </div>
          )}

          {mode === 'fail' && (
            <div className="space-y-5">
              <h2 className="font-display text-xl tracking-[-0.02em]">What went wrong?</h2>

              {formError && (
                <p role="alert" className="rounded-xl border border-[#9b302d]/25 bg-[#9b302d]/[0.05] px-4 py-3 text-sm text-[#8a2724]">
                  {formError}
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="sr-only">Reason for failed attempt</legend>
                {(Object.keys(FAILURE_LABEL) as FailureReason[]).map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      reason === r ? 'border-[#151b1c] bg-[#151b1c]/[0.03]' : 'border-[#151b1c]/[0.12] hover:border-[#151b1c]/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="failure-reason"
                      className="accent-[#151b1c]"
                      checked={reason === r}
                      onChange={() => {
                        setReason(r)
                        setFormError('')
                      }}
                    />
                    {FAILURE_LABEL[r]}
                  </label>
                ))}
              </fieldset>

              <FormField id="fail-note" label={reason === 'other' ? 'Describe what happened' : 'Details (optional)'} required={reason === 'other'}>
                <textarea
                  id="fail-note"
                  className={`${textareaClass()} !min-h-[5rem]`}
                  value={failNote}
                  onChange={(e) => {
                    setFailNote(e.target.value)
                    setFormError('')
                  }}
                />
              </FormField>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={secondaryBtn} onClick={() => setMode('none')}>
                  Back
                </button>
                <button type="button" className={dangerBtn} onClick={submitFail}>
                  Record failed attempt
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* --------------------------- Proof (delivered) ------------------------ */}
      {d.proof && (
        <Card>
          <CardHeader title="Proof of delivery" description={formatDateTime(d.proof.deliveredAt)} />
          <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:px-6">
            {d.proof.photo && (
              <img src={d.proof.photo} alt="Delivered item" className="h-40 w-40 shrink-0 rounded-xl object-cover" />
            )}
            <div className="text-sm">
              <p>
                Received by <strong>{d.proof.recipientName}</strong>
              </p>
              {d.proof.note && <p className="mt-2 text-[#151b1c]/60">{d.proof.note}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------- Timeline ----------------------------- */}
      <Card>
        <CardHeader title="Progress" />
        <ol className="px-5 py-5 sm:px-6">
          {TIMELINE.map((s, i) => {
            const done = reached.has(s)
            const event = [...d.events].reverse().find((e) => e.status === s)
            return (
              <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
                {i < TIMELINE.length - 1 && (
                  <span aria-hidden="true" className={`absolute left-[9px] top-5 h-full w-px ${done ? 'bg-[#151b1c]/40' : 'bg-[#151b1c]/10'}`} />
                )}
                <span
                  aria-hidden="true"
                  className={`relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    done ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/20 bg-white'
                  }`}
                >
                  {done && <Check className="h-3 w-3" />}
                </span>
                <div>
                  <p className={`text-sm ${done ? 'font-medium' : 'text-[#151b1c]/40'}`}>
                    {DELIVERY_META[s].label}
                  </p>
                  {event && <p className="text-xs text-[#151b1c]/40">{formatDateTime(event.at)}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}

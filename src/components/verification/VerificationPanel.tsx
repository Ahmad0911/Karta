import { useEffect, useState } from 'react'
import { BadgeCheck, FlaskConical } from 'lucide-react'

import { inputClass, primaryBtn, secondaryBtn } from '@/components/portal/ui'
import { getVerificationProvider, CODE_RULES, type Channel } from '@/modules/verification'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

const LABEL: Record<Channel, string> = { email: 'Email', phone: 'Phone number' }

/** Verify the signed-in user's email and/or phone with a one-time code. */
export default function VerificationPanel({ channels = ['email', 'phone'] }: { channels?: Channel[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  return (
    <div className="divide-y divide-[#151b1c]/[0.07] rounded-xl border border-[#151b1c]/[0.1]">
      {channels.map((c) => (
        <ChannelRow key={c} channel={c} />
      ))}
    </div>
  )
}

function ChannelRow({ channel }: { channel: Channel }) {
  const user = useAuthStore((s) => s.user)!
  const markVerified = useAuthStore((s) => s.markContactVerified)

  const target = channel === 'email' ? user.email : user.phone ?? ''
  const verified = channel === 'email' ? user.emailVerified : user.phoneVerified

  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [devCode, setDevCode] = useState<string>()
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(Date.now())

  // Tick once a second while a resend countdown is running.
  useEffect(() => {
    if (resendAt <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [resendAt])

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  const send = async () => {
    const provider = getVerificationProvider()
    if (!provider) return setError('Verification isn’t available yet. Please try again later.')
    if (!target) return setError('Add a phone number in Settings first.')

    setBusy(true)
    setError('')
    const r = await provider.request(channel, target)
    setBusy(false)

    if (!r.ok) {
      if (r.retryAfter) {
        setResendAt(r.retryAfter)
        setNow(Date.now())
      }
      return setError(r.error)
    }

    setSent(true)
    setCode('')
    setDevCode(r.devCode)
    setResendAt(r.resendAfter)
    setNow(Date.now())
  }

  const confirm = async () => {
    const provider = getVerificationProvider()
    if (!provider) return
    setBusy(true)
    setError('')
    const r = await provider.confirm(channel, target, code)
    if (!r.ok) {
      setBusy(false)
      return setError(r.error)
    }
    const marked = markVerified(channel, target)
    setBusy(false)
    if (!marked.ok) return setError(marked.error)
    toast.success(`${LABEL[channel]} verified`)
    setSent(false)
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/45">{LABEL[channel]}</p>
          <p className="truncate text-sm font-medium">{target || 'Not added yet'}</p>
        </div>

        {verified ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#265041]">
            <BadgeCheck aria-hidden="true" className="h-4 w-4" /> Verified
          </span>
        ) : !sent ? (
          <button type="button" className={secondaryBtn} onClick={send} disabled={busy || !target}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        ) : null}
      </div>

      {!verified && sent && (
        <div className="mt-4 space-y-3">
          {devCode && (
            <p className="flex items-center gap-2 rounded-lg bg-[#b79a6b]/[0.12] px-3 py-2 text-xs text-[#8a6540]">
              <FlaskConical aria-hidden="true" className="h-4 w-4 shrink-0" />
              Dev only: no message is really sent. Your code is <strong className="font-mono text-sm tracking-widest">{devCode}</strong>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`otp-${channel}`} className="sr-only">Enter the {CODE_RULES.length}-digit code</label>
            <input
              id={`otp-${channel}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_RULES.length}
              placeholder="000000"
              className={`${inputClass(!!error)} !w-40 text-center font-mono text-lg tracking-[0.4em]`}
              value={code}
              aria-invalid={error ? true : undefined}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_RULES.length)); setError('') }}
            />
            <button type="button" className={primaryBtn} disabled={busy || code.length !== CODE_RULES.length} onClick={confirm}>
              {busy ? 'Checking…' : 'Verify'}
            </button>
            <button type="button" className="text-xs font-semibold text-[#8a6540] underline underline-offset-4 disabled:no-underline disabled:opacity-50" disabled={busy || wait > 0} onClick={send}>
              {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
            </button>
          </div>
          <p className="text-xs text-[#151b1c]/45">Sent to {target}. The code expires in 10 minutes.</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-[#9b302d]">{error}</p>}
    </div>
  )
}

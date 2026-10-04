import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'

import Field from '@/components/ui/Field'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { CODE_RULES, getVerificationProvider } from '@/modules/verification'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

export default function ForgotPasswordPage() {
  useDocumentTitle('Reset your password')

  const navigate = useNavigate()
  const accounts = useAuthStore((s) => s.accounts)
  const applyReset = useAuthStore((s) => s.applyPasswordReset)

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [devCode, setDevCode] = useState<string>()

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    const provider = getVerificationProvider()
    if (!provider) return setError('Password reset isn’t available yet. Please try again later.')

    setBusy(true)
    setError('')

    const known = Boolean(accounts[email.trim().toLowerCase()])

    // Same screen whether or not the account exists, so this form can't be used
    // to find out who has an account. Only a real account gets a real code.
    if (known) {
      const r = await provider.request('email', email)
      if (!r.ok) {
        setBusy(false)
        return setError(r.error)
      }
      setDevCode(r.devCode)
    } else {
      setDevCode(undefined)
    }

    setBusy(false)
    setStep('code')
  }

  const reset = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const provider = getVerificationProvider()
    if (!provider) return

    setBusy(true)
    setError('')

    const checked = await provider.confirm('email', email, code)
    if (!checked.ok) {
      setBusy(false)
      return setError(checked.error)
    }

    const r = await applyReset(email, pw)
    setBusy(false)
    if (!r.ok) return setError(r.error)

    toast.success('Password updated. Please sign in.')
    navigate('/login', { replace: true })
  }

  return (
    <>
      <h1 className="font-display text-5xl font-medium tracking-tight">Reset your password.</h1>
      <p className="mt-2 text-sm text-ink/55">
        {step === 'email' ? 'Enter your email and we’ll send you a code.' : `If ${email.trim()} has an account, a ${CODE_RULES.length}-digit code is on its way.`}
      </p>

      {step === 'email' ? (
        <form onSubmit={send} className="mt-8 space-y-4" noValidate>
          <Field label="Email" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} autoComplete="email" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="btn-dark w-full" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-8 space-y-4" noValidate>
          {devCode && (
            <p className="flex items-center gap-2 rounded-lg bg-[#b79a6b]/[0.12] px-3 py-2 text-xs text-[#8a6540]">
              <FlaskConical aria-hidden="true" className="h-4 w-4 shrink-0" /> Dev only: your code is <strong className="font-mono text-sm tracking-widest">{devCode}</strong>
            </p>
          )}
          <Field label="6-digit code" required inputMode="numeric" maxLength={CODE_RULES.length} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }} autoComplete="one-time-code" />
          <div>
            <Field label="New password" type={show ? 'text' : 'password'} required minLength={8} value={pw} onChange={(e) => { setPw(e.target.value); setError('') }} autoComplete="new-password" />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-ink/60">
              <input type="checkbox" className="accent-[#151b1c]" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="btn-dark w-full" disabled={busy || code.length !== CODE_RULES.length || !pw}>{busy ? 'Saving…' : 'Set new password'}</button>
          <button type="button" className="w-full text-center text-sm text-ink/55 underline underline-offset-4" onClick={() => { setStep('email'); setCode(''); setError('') }}>Use a different email</button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink/55">
        Remembered it? <Link to="/login" className="font-semibold text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </>
  )
}

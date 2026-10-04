import { useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Link,
<<<<<<< HEAD
=======
  Navigate,
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
<<<<<<< HEAD
import Field from '@/components/ui/Field'
import { useAuthStore } from '@/store/auth.store'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
=======
import { ArrowLeft, ShieldCheck } from 'lucide-react'

import Field from '@/components/ui/Field'
import RegisterChooser from './RegisterChooser'
import { passwordProblem } from '@/lib/password'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { isNigerianPhone } from '@/modules/vendors/lib/onboarding'
import { useAuthStore } from '@/store/auth.store'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)

export default function RegisterPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

<<<<<<< HEAD
  const isVendor = params.get('as') === 'vendor'
=======
  const as = params.get('as')
  const isVendor = as === 'vendor'
  const showChooser = as !== 'vendor' && as !== 'customer'
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)

  useDocumentTitle(isVendor ? 'Apply to sell' : 'Create your account')

  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
  })
<<<<<<< HEAD
  const [error, setError] = useState('')

  const register = useAuthStore((s) => s.register)

  const returnTo = (location.state as { from?: string } | null)?.from
  const destination = returnTo ?? (isVendor ? '/vendor' : '/')

  const set =
    (key: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) =>
      setF((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()

    if (f.password.length < 8) {
      setError('Your password needs at least 8 characters.')
      return
    }

    const result = register({
      name: f.name,
      email: f.email,
      phone: f.phone,
=======
  const [agreed, setAgreed] = useState(false)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const user = useAuthStore((s) => s.user)
  const register = useAuthStore((s) => s.register)

  const returnTo = (location.state as { from?: string } | null)?.from

  // Vendors go straight into their application; customers back to where they were.
  const destination = returnTo ?? (isVendor ? '/vendor/onboarding' : '/')

  // Already signed in: nothing to register.
  if (user && !busy) return <Navigate to={destination} replace />

  const set = (key: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => {
    setF((prev) => ({ ...prev, [key]: e.target.value }))
    setError('')
  }

  /** First problem found, phrased for a person. */
  const validate = (): string => {
    if (f.name.trim().length < 2) return 'Enter your full name.'
    if (isVendor && f.businessName.trim().length < 2) return 'Enter your business or workshop name.'
    if (!EMAIL.test(f.email.trim())) return 'Enter a valid email address.'
    if (!isNigerianPhone(f.phone)) return 'Enter a valid Nigerian phone number, for example 0803 123 4567.'
    const pw = passwordProblem(f.password, f.email)
    if (pw) return pw
    if (!agreed) return 'Please accept the terms and privacy policy to continue.'
    return ''
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return

    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError('')

    const result = await register({
      name: f.name,
      email: f.email,
      phone: f.phone,
      password: f.password,
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
      role: isVendor ? 'vendor' : 'customer',
      businessName: f.businessName,
    })

<<<<<<< HEAD
=======
    setBusy(false)

>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
    if (!result.ok) {
      setError(result.error)
      return
    }

    navigate(destination, { replace: true })
  }
<<<<<<< HEAD

  return (
    <>
=======

  if (showChooser) return <RegisterChooser />

  return (
    <>
      <Link to="/register" state={location.state} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-ink/55 hover:text-ink">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Choose a different account type
      </Link>

>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
      <h1 className="font-display text-5xl font-medium tracking-tight">
        {isVendor ? 'Apply to sell.' : 'Create your account.'}
      </h1>

      <p className="mt-2 text-sm text-ink/55">
        {isVendor
<<<<<<< HEAD
          ? 'Tell us about you and your business. We review every vendor before pieces go live.'
          : 'Basic verification: name, phone and email (BRD §10.1).'}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field
          label="Full name"
          required
          value={f.name}
          onChange={set('name')}
          autoComplete="name"
        />

        {isVendor && (
          <Field
            label="Business name"
            required
            value={f.businessName}
            onChange={set('businessName')}
            autoComplete="organization"
          />
        )}

        <Field
          label="Email"
          type="email"
          required
          value={f.email}
          onChange={set('email')}
          autoComplete="email"
        />

        <Field
          label="Phone number"
          type="tel"
          required
          value={f.phone}
          onChange={set('phone')}
          autoComplete="tel"
        />

        <Field
          label="Password"
          type="password"
          required
          minLength={8}
          value={f.password}
          onChange={set('password')}
          autoComplete="new-password"
        />
=======
          ? 'Create your account, then complete a short application.'
          : 'Basic verification: name, phone and email (BRD §10.1).'}
      </p>

      {isVendor && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-[#8f7651]/25 bg-[#b79a6b]/[0.08] p-4 text-sm leading-6 text-ink/70">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#8f7651]" />
          <p>
            Every vendor is verified by the Karta team before anything goes live. You’ll upload an ID, proof
            of address and payout details. Review usually takes 2 to 3 working days.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Full name" required value={f.name} onChange={set('name')} autoComplete="name" />

        {isVendor && (
          <Field label="Business name" required value={f.businessName} onChange={set('businessName')} autoComplete="organization" />
        )}

        <Field label="Email" type="email" required value={f.email} onChange={set('email')} autoComplete="email" />

        <Field label="Phone number" type="tel" required value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="0803 123 4567" />

        <div>
          <Field
            label="Password"
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            value={f.password}
            onChange={set('password')}
            autoComplete="new-password"
            aria-describedby="pw-hint"
          />
          <div className="mt-2 flex items-center justify-between gap-4">
            <p id="pw-hint" className="text-xs leading-5 text-ink/50">
              At least 8 characters, with letters. No common passwords.
            </p>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink/60">
              <input type="checkbox" className="accent-[#151b1c]" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show
            </label>
          </div>
        </div>

        <label className="flex cursor-pointer gap-3 text-sm leading-6 text-ink/65">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-[#151b1c]"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked)
              setError('')
            }}
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="font-semibold text-ink underline underline-offset-4">terms</Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-4">privacy policy</Link>.
          </span>
        </label>
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

<<<<<<< HEAD
        <button className="btn-dark w-full">
          {isVendor ? 'Submit application' : 'Create account'}
=======
        <button className="btn-dark w-full" disabled={busy}>
          {busy ? 'Please wait…' : isVendor ? 'Create vendor account' : 'Create account'}
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/55">
        Already registered?{' '}
<<<<<<< HEAD
        <Link
          to="/login"
          state={{ from: returnTo }}
          className="font-semibold text-ink underline underline-offset-4"
        >
=======
        <Link to="/login" state={{ from: returnTo }} className="font-semibold text-ink underline underline-offset-4">
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
          Sign in
        </Link>
      </p>

<<<<<<< HEAD
      <p className="mt-3 text-center text-sm text-ink/55">
        {isVendor ? 'Just shopping? ' : 'Selling furniture? '}
        <Link
          to={isVendor ? '/register' : '/register?as=vendor'}
          state={location.state}
          className="font-semibold text-ink underline underline-offset-4"
        >
          {isVendor ? 'Create a customer account' : 'Apply as a vendor'}
        </Link>
      </p>
    </>
  )
}
=======
    </>
  )
}
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)

import { useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import Field from '@/components/ui/Field'
import { useAuthStore } from '@/store/auth.store'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export default function RegisterPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const isVendor = params.get('as') === 'vendor'

  useDocumentTitle(isVendor ? 'Apply to sell' : 'Create your account')

  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
  })
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
      role: isVendor ? 'vendor' : 'customer',
      businessName: f.businessName,
    })

    if (!result.ok) {
      setError(result.error)
      return
    }

    navigate(destination, { replace: true })
  }

  return (
    <>
      <h1 className="font-display text-5xl font-medium tracking-tight">
        {isVendor ? 'Apply to sell.' : 'Create your account.'}
      </h1>

      <p className="mt-2 text-sm text-ink/55">
        {isVendor
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

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button className="btn-dark w-full">
          {isVendor ? 'Submit application' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/55">
        Already registered?{' '}
        <Link
          to="/login"
          state={{ from: returnTo }}
          className="font-semibold text-ink underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>

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
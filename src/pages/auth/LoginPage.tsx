import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Field from '@/components/ui/Field'
import { useAuthStore } from '@/store/auth.store'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import type { Role } from '@/types'

// Where each staff role lands when there is no page to return to.
const LANDING: Partial<Record<Role, string>> = {
  vendor: '/vendor',
  admin: '/admin',
  logistics: '/logistics',
}

export default function LoginPage() {
  useDocumentTitle('Sign in')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const login = useAuthStore((s) => s.login)
  const devLogin = useAuthStore((s) => s.devLogin)
  const navigate = useNavigate()

  const from = (useLocation().state as { from?: string } | null)?.from

  const finish = () => {
    const signedIn = useAuthStore.getState().user
    const landing = signedIn ? LANDING[signedIn.role] : undefined
    navigate(from ?? landing ?? '/', { replace: true })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError('')

    const result = await login(email, password)

    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      setPassword('')
      return
    }

    finish()
  }

  const devAs = (role: Role) => {
    if (devLogin(email.trim() || `${role}@karta.test`, role)) finish()
  }

  return (
    <>
      <h1 className="font-display text-5xl font-medium tracking-tight">
        Welcome back.
      </h1>

      <p className="mt-2 text-sm text-ink/55">
        Sign in to continue to checkout and your orders.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <Field
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <p className="text-right text-sm">
          <Link to="/forgot-password" className="text-ink/60 underline underline-offset-4 hover:text-ink">Forgot password?</Link>
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button className="btn-dark w-full" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/55">
        New to Karta?{' '}
        <Link
          to="/register"
          state={{ from }}
          className="font-semibold text-ink underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-10 border-t border-ink/10 pt-5 text-xs text-ink/45">
          Dev only (skips the password): sign in as{' '}
          {(['vendor', 'admin', 'logistics'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => devAs(r)}
              className="mr-2 underline"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import Field from '@/components/ui/Field'
import { Notice } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'
import type { Role } from '@/types'

const HOME: Partial<Record<Role, string>> = {
  vendor: '/vendor',
  admin: '/admin',
  super_admin: '/admin',
  logistics: '/logistics',
}

export default function ChangePasswordPage() {
  useDocumentTitle('Change password')

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)!
  const changePassword = useAuthStore((s) => s.changePassword)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const forced = Boolean(user.mustChangePassword)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return

    if (next !== confirm) {
      setError('The two new passwords don’t match.')
      return
    }

    setBusy(true)
    setError('')
    const r = await changePassword(current, next)
    setBusy(false)

    if (!r.ok) {
      setError(r.error)
      return
    }

    toast.success('Password changed.')
    navigate(HOME[user.role] ?? '/account', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-xl py-16 sm:py-24">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">Security</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] sm:text-5xl">
          {forced ? 'Choose your own password.' : 'Change your password.'}
        </h1>

        {forced && (
          <div className="mt-6">
            <Notice tone="warning" title="You’re using a temporary password">
              Karta staff created this account for you. For your security, choose a new password
              before continuing.
            </Notice>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label={forced ? 'Temporary password' : 'Current password'} type={show ? 'text' : 'password'} required value={current} onChange={(e) => { setCurrent(e.target.value); setError('') }} autoComplete="current-password" />
          <Field label="New password" type={show ? 'text' : 'password'} required minLength={8} value={next} onChange={(e) => { setNext(e.target.value); setError('') }} autoComplete="new-password" />
          <Field label="Confirm new password" type={show ? 'text' : 'password'} required value={confirm} onChange={(e) => { setConfirm(e.target.value); setError('') }} autoComplete="new-password" />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/60">
            <input type="checkbox" className="accent-[#151b1c]" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
          </label>

          <p className="text-xs leading-5 text-ink/50">
            At least 8 characters, with letters. Avoid common passwords and anything containing your email name.
          </p>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <button className="btn-dark w-full" disabled={busy || !current || !next || !confirm}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  )
}

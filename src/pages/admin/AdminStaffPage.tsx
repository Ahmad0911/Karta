import { useState, type FormEvent } from 'react'
import { Check, Copy, Truck } from 'lucide-react'

import { Card, CardHeader, EmptyState, FormField, Notice, PageHeader, StatusPill, dangerBtn, inputClass, primaryBtn, secondaryBtn } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

export default function AdminStaffPage() {
  useDocumentTitle('Drivers')

  const accounts = useAuthStore((s) => s.accounts)
  const create = useAuthStore((s) => s.createLogisticsAccount)
  const setDisabled = useAuthStore((s) => s.setAccountDisabled)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const drivers = Object.values(accounts)
    .filter((a) => a.user.role === 'logistics')
    .sort((a, b) => a.user.name.localeCompare(b.user.name))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError('')
    const r = await create({ name, email, phone })
    setBusy(false)

    if (!r.ok) {
      setError(r.error)
      return
    }

    setIssued({ email: email.trim().toLowerCase(), password: r.tempPassword })
    setCopied(false)
    setName('')
    setEmail('')
    setPhone('')
  }

  const copy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.password)
      setCopied(true)
    } catch {
      toast.error('Couldn’t copy. Select the password and copy it manually.')
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Drivers"
        description="Driver accounts are created by staff only. Each gets a one-time temporary password and must choose their own at first sign-in."
      />

      {issued && (
        <Notice tone="success" title={`Account created for ${issued.email}`}>
          <p>
            Share this temporary password privately (phone call or WhatsApp). <strong>It is shown only once.</strong>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-white px-4 py-2 font-mono text-base tracking-wider select-all">{issued.password}</code>
            <button type="button" className={secondaryBtn} onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setIssued(null)}>Done</button>
          </div>
        </Notice>
      )}

      <Card>
        <CardHeader title="Add a driver" />
        <form onSubmit={submit} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6" noValidate>
          <FormField id="d-name" label="Full name" required>
            <input id="d-name" className={inputClass()} value={name} onChange={(e) => { setName(e.target.value); setError('') }} />
          </FormField>
          <FormField id="d-email" label="Email" required>
            <input id="d-email" type="email" className={inputClass()} value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
          </FormField>
          <FormField id="d-phone" label="Phone" required>
            <input id="d-phone" type="tel" className={inputClass()} value={phone} placeholder="0803 123 4567" onChange={(e) => { setPhone(e.target.value); setError('') }} />
          </FormField>

          <div className="flex items-end justify-end">
            <button className={primaryBtn} disabled={busy}>{busy ? 'Creating…' : 'Create driver account'}</button>
          </div>

          {error && <p role="alert" className="text-sm text-[#9b302d] sm:col-span-2">{error}</p>}
        </form>
      </Card>

      <Card>
        <CardHeader title="Driver accounts" description={`${drivers.length} total`} />
        {drivers.length === 0 ? (
          <EmptyState icon={<Truck className="h-5 w-5" />} title="No drivers yet" body="Add a driver above. They’ll sign in and see only the deliveries assigned to them." />
        ) : (
          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {drivers.map((d) => (
              <li key={d.user.email} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{d.user.name}</span>
                  <span className="block truncate text-xs text-[#151b1c]/45">{d.user.email} · {d.user.phone}</span>
                </span>
                {d.user.mustChangePassword && <StatusPill tone="amber">Temp password</StatusPill>}
                <StatusPill tone={d.disabled ? 'red' : 'green'}>{d.disabled ? 'Deactivated' : 'Active'}</StatusPill>
                <button
                  type="button"
                  className={d.disabled ? secondaryBtn : dangerBtn}
                  onClick={() => {
                    const r = setDisabled(d.user.email, !d.disabled)
                    if (r.ok) toast.success(d.disabled ? 'Driver reactivated' : 'Driver deactivated. They can no longer sign in.')
                    else toast.error(r.error)
                  }}
                >
                  {d.disabled ? 'Reactivate' : 'Deactivate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

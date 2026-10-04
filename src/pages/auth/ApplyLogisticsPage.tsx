import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FileText, ShieldCheck, Trash2, Truck, Upload } from 'lucide-react'

import { FormField, Notice, dangerBtn, inputClass, primaryBtn, secondaryBtn } from '@/components/portal/ui'
import { CHECKOUT_STATES } from '@/config/checkout'
import { formatDate } from '@/lib/date'
import { passwordProblem } from '@/lib/password'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import {
  LOGISTICS_DOCS,
  VEHICLES,
  useApplicationsStore,
  validateApplication,
  type ApplicationInput,
  type LogisticsDocKind,
} from '@/modules/logistics/applications.store'
import VerificationPanel from '@/components/verification/VerificationPanel'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_MB = 5
const TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function ApplyLogisticsPage() {
  useDocumentTitle('Drive for Karta')

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const register = useAuthStore((s) => s.register)
  const refreshSession = useAuthStore((s) => s.refreshSession)
  const existing = useApplicationsStore((s) => (user ? s.byEmail[user.email.trim().toLowerCase()] : undefined))
  const submit = useApplicationsStore((s) => s.submit)

  const [account, setAccount] = useState({ email: '', password: '' })
  const [f, setF] = useState<ApplicationInput>({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    state: '',
    city: '',
    vehicle: '',
    plateNumber: '',
    licenceNumber: '',
    experienceYears: '',
    guarantorName: '',
    guarantorPhone: '',
    documents: [],
    agreed: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const fileInputs = useRef<Partial<Record<LogisticsDocKind, HTMLInputElement | null>>>({})

  // Already a driver: nothing to apply for.
  if (user?.role === 'logistics') return <Navigate to="/logistics" replace />

  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
    setFormError('')
  }

  const text = (k: keyof ApplicationInput) => (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never)

  const field = (k: string) => ({
    id: `l-${k}`,
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? `l-${k}-msg` : undefined,
  })

  const upload = (kind: LogisticsDocKind) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!TYPES.includes(file.type)) return toast.error('Upload a PDF, JPG or PNG file.')
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`${file.name} is larger than ${MAX_MB} MB.`)

    // MOCK: only metadata is kept. The real file goes to secure storage via the API.
    set('documents', [...f.documents.filter((d) => d.kind !== kind), { kind, fileName: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) }])
    setErrors((x) => ({ ...x, [kind]: '' }))
  }

  /* ----------------------------- Status panels ------------------------------ */

  if (user && existing && existing.status !== 'rejected') {
    return (
      <Shell>
        {existing.status === 'under_review' ? (
          <>
            <Notice tone="info" title="Your application is under review">
              Submitted {formatDate(existing.submittedAt)}. We verify your ID, licence, vehicle papers and guarantor.
              This usually takes 2 to 3 working days. We’ll contact you on {existing.phone}.
            </Notice>
            {!user.phoneVerified && (
              <div className="mt-6">
                <p className="mb-3 text-sm text-ink/60">We can’t approve you until your phone number is verified.</p>
                <VerificationPanel channels={['phone']} />
              </div>
            )}
            <Link to="/account" className={`${secondaryBtn} mt-6`}>Back to my account</Link>
          </>
        ) : (
          <>
            <Notice tone="success" title="You’re approved. Welcome to the team.">
              Your driver access is ready.
            </Notice>
            <button
              type="button"
              className={`${primaryBtn} mt-6`}
              onClick={() => {
                refreshSession()
                navigate('/logistics', { replace: true })
              }}
            >
              <Truck className="h-4 w-4" /> Open my driver portal
            </button>
          </>
        )}
      </Shell>
    )
  }

  if (user && user.role !== 'customer') {
    return (
      <Shell>
        <Notice tone="warning" title="This account can’t apply as a driver">
          Vendor and staff accounts stay separate from driver accounts. Please apply with a different email address.
        </Notice>
      </Shell>
    )
  }

  /* -------------------------------- Submit ---------------------------------- */

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return

    const found = validateApplication(f)

    // Signed-out applicants also create their account.
    if (!user) {
      if (!EMAIL.test(account.email.trim())) found.email = 'Enter a valid email address.'
      const pw = passwordProblem(account.password, account.email)
      if (pw) found.password = pw
    }

    setErrors(found)
    if (Object.keys(found).length) {
      setFormError(`Please fix the ${Object.keys(found).length} highlighted item${Object.keys(found).length === 1 ? '' : 's'}.`)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }

    setBusy(true)
    setFormError('')

    let email = user?.email ?? ''

    if (!user) {
      const created = await register({ name: f.name, email: account.email, phone: f.phone, password: account.password, role: 'customer' })
      if (!created.ok) {
        setBusy(false)
        setFormError(created.error)
        return
      }
      email = account.email
    }

    const r = submit(email, f)
    setBusy(false)

    if (!r.ok) {
      if (r.fields) setErrors(r.fields)
      setFormError(r.error)
      return
    }

    toast.success('Application submitted. We’ll be in touch.')
  }

  return (
    <Shell>
      {existing?.status === 'rejected' && (
        <div className="mb-6">
          <Notice tone="danger" title="Your last application wasn’t approved">
            {existing.note} You’re welcome to correct this and apply again.
          </Notice>
        </div>
      )}

      <form onSubmit={send} className="space-y-10" noValidate>
        {/* ------------------------------ You ------------------------------ */}
        <Section title="About you">
          <FormField id="l-name" label="Full name" required error={errors.name}>
            <input {...field('name')} className={inputClass(!!errors.name)} value={f.name} autoComplete="name" onChange={text('name')} />
          </FormField>
          <FormField id="l-phone" label="Phone number" required error={errors.phone} hint="Customers and our team will call this number.">
            <input {...field('phone')} type="tel" className={inputClass(!!errors.phone)} value={f.phone} autoComplete="tel" placeholder="0803 123 4567" onChange={text('phone')} />
          </FormField>

          {!user && (
            <>
              <FormField id="l-email" label="Email" required error={errors.email}>
                <input {...field('email')} type="email" className={inputClass(!!errors.email)} value={account.email} autoComplete="email" onChange={(e) => { setAccount((a) => ({ ...a, email: e.target.value })); setErrors((x) => ({ ...x, email: '' })) }} />
              </FormField>
              <div>
                <FormField id="l-password" label="Password" required error={errors.password}>
                  <input {...field('password')} type={show ? 'text' : 'password'} className={inputClass(!!errors.password)} value={account.password} autoComplete="new-password" onChange={(e) => { setAccount((a) => ({ ...a, password: e.target.value })); setErrors((x) => ({ ...x, password: '' })) }} />
                </FormField>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[#151b1c]/60">
                  <input type="checkbox" className="accent-[#151b1c]" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
                </label>
              </div>
            </>
          )}

          <FormField id="l-state" label="State you operate in" required error={errors.state}>
            <select {...field('state')} className={inputClass(!!errors.state)} value={f.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">Select a state</option>
              {CHECKOUT_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField id="l-city" label="City or town" required error={errors.city}>
            <input {...field('city')} className={inputClass(!!errors.city)} value={f.city} onChange={text('city')} />
          </FormField>
        </Section>

        {/* ----------------------------- Vehicle ----------------------------- */}
        <Section title="Your vehicle">
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">
              Vehicle type <span className="text-[#9b302d]">*</span>
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {VEHICLES.map((v) => (
                <label key={v.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${f.vehicle === v.id ? 'border-[#151b1c] bg-[#151b1c]/[0.03]' : 'border-[#151b1c]/[0.12] hover:border-[#151b1c]/30'}`}>
                  <input type="radio" name="vehicle" className="mt-1 accent-[#151b1c]" checked={f.vehicle === v.id} onChange={() => set('vehicle', v.id)} />
                  <span><span className="block text-sm font-semibold">{v.label}</span><span className="block text-xs text-[#151b1c]/50">{v.hint}</span></span>
                </label>
              ))}
            </div>
            {errors.vehicle && <p className="mt-1.5 text-xs text-[#9b302d]">{errors.vehicle}</p>}
          </fieldset>

          <FormField id="l-plateNumber" label="Plate number" required error={errors.plateNumber}>
            <input {...field('plateNumber')} className={`${inputClass(!!errors.plateNumber)} uppercase`} value={f.plateNumber} placeholder="ABC-123DE" onChange={text('plateNumber')} />
          </FormField>
          <FormField id="l-licenceNumber" label="Driver’s licence number" required error={errors.licenceNumber}>
            <input {...field('licenceNumber')} className={`${inputClass(!!errors.licenceNumber)} uppercase`} value={f.licenceNumber} autoComplete="off" onChange={text('licenceNumber')} />
          </FormField>
          <FormField id="l-experienceYears" label="Years of driving experience" required error={errors.experienceYears}>
            <input {...field('experienceYears')} inputMode="numeric" className={inputClass(!!errors.experienceYears)} value={f.experienceYears} onChange={(e) => set('experienceYears', e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </FormField>
        </Section>

        {/* ---------------------------- Guarantor ---------------------------- */}
        <Section title="Your guarantor" note="Someone who knows you and can vouch for you. We will call them.">
          <FormField id="l-guarantorName" label="Guarantor’s full name" required error={errors.guarantorName}>
            <input {...field('guarantorName')} className={inputClass(!!errors.guarantorName)} value={f.guarantorName} onChange={text('guarantorName')} />
          </FormField>
          <FormField id="l-guarantorPhone" label="Guarantor’s phone" required error={errors.guarantorPhone}>
            <input {...field('guarantorPhone')} type="tel" className={inputClass(!!errors.guarantorPhone)} value={f.guarantorPhone} onChange={text('guarantorPhone')} />
          </FormField>
        </Section>

        {/* ---------------------------- Documents ---------------------------- */}
        <Section title="Documents" note={`PDF, JPG or PNG, up to ${MAX_MB} MB each. Only the Karta verification team sees them.`} single>
          {LOGISTICS_DOCS.map((d) => {
            const doc = f.documents.find((x) => x.kind === d.kind)
            return (
              <div key={d.kind} className={`rounded-xl border p-4 ${errors[d.kind] ? 'border-[#9b302d]/50' : 'border-[#151b1c]/[0.1]'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{d.label} <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#151b1c]/35">Required</span></p>
                    <p className="mt-0.5 text-xs text-[#151b1c]/45">{d.hint}</p>
                  </div>
                  <div>
                    <input ref={(el) => { fileInputs.current[d.kind] = el }} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" aria-label={`Upload ${d.label}`} onChange={upload(d.kind)} />
                    <button type="button" className={secondaryBtn} onClick={() => fileInputs.current[d.kind]?.click()}><Upload className="h-4 w-4" /> {doc ? 'Replace' : 'Upload'}</button>
                  </div>
                </div>
                {doc && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#315d4b]/[0.07] px-3 py-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-[#315d4b]" />
                    <span className="min-w-0 flex-1 truncate">{doc.fileName}</span>
                    <span className="text-xs text-[#151b1c]/40">{doc.sizeKb} KB</span>
                    <button type="button" aria-label={`Remove ${doc.fileName}`} className={`${dangerBtn} !h-8 !px-3`} onClick={() => set('documents', f.documents.filter((x) => x.kind !== d.kind))}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                {errors[d.kind] && <p className="mt-2 text-xs text-[#9b302d]">{errors[d.kind]}</p>}
              </div>
            )
          })}
        </Section>

        <div>
          <label className="flex cursor-pointer gap-3 text-sm leading-6 text-[#151b1c]/70">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#151b1c]" aria-invalid={errors.agreed ? true : undefined} checked={f.agreed} onChange={(e) => set('agreed', e.target.checked)} />
            <span>I confirm the information is true, I consent to Karta verifying it (including contacting my guarantor), and I agree to the <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-4">driver terms</Link>.</span>
          </label>
          {errors.agreed && <p className="mt-1.5 text-xs text-[#9b302d]">{errors.agreed}</p>}
        </div>

        {formError && <p role="alert" className="text-sm text-[#9b302d]">{formError}</p>}

        <button className={`${primaryBtn} w-full sm:w-auto`} disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
      </form>

      {!user && (
        <p className="mt-8 text-sm text-ink/55">
          Already have an account? <Link to="/login" state={{ from: '/apply/logistics' }} className="font-semibold text-ink underline underline-offset-4">Sign in</Link> to apply faster.
        </p>
      )}
    </Shell>
  )
}

/* -------------------------------------------------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-3xl py-14 sm:py-20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">Karta logistics</p>
        <h1 className="mt-3 font-display text-5xl font-medium leading-[1] tracking-[-0.045em] sm:text-6xl">Drive for Karta.</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-ink/60">
          Deliver beautiful furniture across Nigeria. Apply below. Every driver is verified by the Karta team before getting any deliveries.
        </p>
        <p className="mt-5 flex max-w-xl gap-3 rounded-2xl border border-[#8f7651]/25 bg-[#b79a6b]/[0.08] p-4 text-sm leading-6 text-ink/70">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#8f7651]" />
          We check your ID, licence, vehicle papers and call your guarantor. You can’t see customer addresses or accept jobs until you’re approved.
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </main>
  )
}

function Section({ title, note, single, children }: { title: string; note?: string; single?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl tracking-[-0.025em]">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink/50">{note}</p>}
      <div className={`mt-5 grid gap-5 ${single ? '' : 'sm:grid-cols-2'}`}>{children}</div>
    </section>
  )
}

import { uuid } from '@/lib/id'
import { useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileText, Trash2, Upload } from 'lucide-react'

import {
  Card,
  FormField,
  Notice,
  PageHeader,
  dangerBtn,
  inputClass,
  primaryBtn,
  secondaryBtn,
  textareaClass,
} from '@/components/portal/ui'
import { categories } from '@/data/categories'
import { formatDate } from '@/lib/date'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import VerificationPanel from '@/components/verification/VerificationPanel'
import { toast } from '@/store/toast.store'

import { DOCUMENT_SPECS, NIGERIAN_BANKS, NIGERIAN_STATES } from '@/modules/vendors/data/reference'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import {
  ONBOARDING_STEPS,
  isEditable,
  requiredDocumentKinds,
  validateStep,
  type FieldErrors,
} from '@/modules/vendors/lib/onboarding'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import type { BusinessType, DocumentKind, VendorProfile } from '@/modules/vendors/types'

const MAX_DOC_MB = 5
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function VendorOnboardingPage() {
  useDocumentTitle('Vendor application')

  const navigate = useNavigate()
  const { email, workspace } = useVendor()
  const { profile } = workspace

  const updateProfile = useVendorStore((s) => s.updateProfile)
  const submitApplication = useVendorStore((s) => s.submitApplication)

  const [errors, setErrors] = useState<FieldErrors>({})
  const [showAllErrors, setShowAllErrors] = useState(false)

  const step = Math.min(profile.onboardingStep, ONBOARDING_STEPS.length - 1)
  const editable = isEditable(profile)

  if (profile.status === 'approved') return <Navigate to="/vendor" replace />

  /* ------------------------------- helpers -------------------------------- */

  const patch = (fn: (p: VendorProfile) => VendorProfile) => updateProfile(email, fn)

  const clear = (...keys: string[]) =>
    setErrors((prev) => {
      const next = { ...prev }
      keys.forEach((k) => delete next[k])
      return next
    })

  const goTo = (n: number) => {
    setErrors({})
    setShowAllErrors(false)
    patch((p) => ({ ...p, onboardingStep: n }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = () => {
    const found = validateStep(profile, step)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      // Move focus to the first problem so keyboard users aren't lost.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    goTo(step + 1)
  }

  const submit = () => {
    // Re-validate every step so nothing slips through.
    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      const found = validateStep(profile, i)
      if (Object.keys(found).length > 0) {
        toast.error(`Please complete the “${ONBOARDING_STEPS[i].label}” section first.`)
        setShowAllErrors(true)
        goTo(i)
        setErrors(found)
        return
      }
    }

    const result = submitApplication(email)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Application submitted. We’ll be in touch shortly.')
    navigate('/vendor', { replace: true })
  }

  const field = (id: keyof FieldErrors & string) => ({
    id: `f-${id}`,
    'aria-invalid': errors[id] ? (true as const) : undefined,
    'aria-describedby': errors[id] ? `f-${id}-msg` : undefined,
  })

  /* ------------------------------ read-only ------------------------------- */

  if (!editable) {
    const rejected = profile.status === 'rejected'
    const suspended = profile.status === 'suspended'

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Application"
          title={
            rejected
              ? 'Your application wasn’t approved.'
              : suspended
                ? 'Your store is suspended.'
                : 'Your application is with our team.'
          }
        />

        {rejected || suspended ? (
          <Notice tone="danger" title={rejected ? 'Decision' : 'Reason'}>
            {profile.reviewNote}
          </Notice>
        ) : (
          <Notice tone="info" title="Under review">
            Submitted {profile.submittedAt ? formatDate(profile.submittedAt) : 'recently'}. We’ll
            email {profile.contact.email} as soon as there’s an update. You can’t edit the
            application while it is being reviewed.
          </Notice>
        )}

        <Link to="/vendor" className={secondaryBtn}>
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
      </div>
    )
  }

  /* -------------------------------- render -------------------------------- */

  const b = profile.business
  const c = profile.contact
  const x = profile.payout

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vendor application"
        title="Tell us about your business."
        description="Your progress is saved automatically. Every vendor is reviewed by the Karta team before products go live."
      />

      {profile.status === 'changes_requested' && profile.reviewNote && (
        <Notice tone="danger" title="Changes requested">
          {profile.reviewNote}
        </Notice>
      )}

      {/* Stepper */}
      <nav aria-label="Application progress">
        <ol className="grid grid-cols-5 gap-2">
          {ONBOARDING_STEPS.map((s, i) => {
            const done = i < step
            const current = i === step
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => i <= step && goTo(i)}
                  disabled={i > step}
                  aria-current={current ? 'step' : undefined}
                  className="w-full text-left disabled:cursor-not-allowed"
                >
                  <span
                    className={`block h-1 rounded-full ${
                      done || current ? 'bg-[#151b1c]' : 'bg-[#151b1c]/10'
                    }`}
                  />
                  <span className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    {done ? (
                      <Check className="h-3 w-3 text-[#315d4b]" />
                    ) : (
                      <span className="text-[#151b1c]/35">{i + 1}</span>
                    )}
                    <span className={`hidden sm:inline ${current ? 'text-[#151b1c]' : 'text-[#151b1c]/40'}`}>
                      {s.label}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <Card className="p-5 sm:p-8">
        {Object.keys(errors).length > 0 && (
          <div role="alert" className="mb-6 rounded-xl border border-[#9b302d]/25 bg-[#9b302d]/[0.05] px-4 py-3 text-sm text-[#8a2724]">
            Please fix the {Object.keys(errors).length} highlighted item
            {Object.keys(errors).length === 1 ? '' : 's'} to continue.
          </div>
        )}

        {/* ---------------------------- 1 · Business ---------------------------- */}
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField id="f-name" label="Business or workshop name" required error={errors.name}>
                <input
                  {...field('name')}
                  className={inputClass(!!errors.name)}
                  value={b.name}
                  autoComplete="organization"
                  onChange={(e) => {
                    patch((p) => ({ ...p, business: { ...p.business, name: e.target.value } }))
                    clear('name')
                  }}
                />
              </FormField>
            </div>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">
                How do you trade?
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['individual', 'Individual maker', 'You trade under your own name.'],
                    ['registered', 'Registered business', 'You have a CAC registration.'],
                  ] as [BusinessType, string, string][]
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                      b.type === value
                        ? 'border-[#151b1c] bg-[#151b1c]/[0.03]'
                        : 'border-[#151b1c]/[0.12] hover:border-[#151b1c]/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="business-type"
                      className="mt-1 accent-[#151b1c]"
                      checked={b.type === value}
                      onChange={() => {
                        patch((p) => ({ ...p, business: { ...p.business, type: value } }))
                        clear('rcNumber', 'business_registration')
                      }}
                    />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-[#151b1c]/50">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {b.type === 'registered' && (
              <div className="sm:col-span-2">
                <FormField id="f-rcNumber" label="CAC registration number" required error={errors.rcNumber}>
                  <input
                    {...field('rcNumber')}
                    className={inputClass(!!errors.rcNumber)}
                    value={b.rcNumber}
                    placeholder="RC1234567"
                    onChange={(e) => {
                      patch((p) => ({ ...p, business: { ...p.business, rcNumber: e.target.value } }))
                      clear('rcNumber')
                    }}
                  />
                </FormField>
              </div>
            )}

            <div className="sm:col-span-2">
              <FormField
                id="f-description"
                label="What do you make?"
                required
                error={errors.description}
                hint={`${b.description.trim().length} characters · at least 40`}
              >
                <textarea
                  {...field('description')}
                  className={textareaClass(!!errors.description)}
                  value={b.description}
                  placeholder="Materials, style, how long you have been making furniture…"
                  onChange={(e) => {
                    patch((p) => ({ ...p, business: { ...p.business, description: e.target.value } }))
                    clear('description')
                  }}
                />
              </FormField>
            </div>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">
                Categories you sell <span className="text-[#9b302d]">*</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const on = b.categoryIds.includes(cat.id)
                  return (
                    <label
                      key={cat.id}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#bc8e63] ${
                        on
                          ? 'border-[#151b1c] bg-[#151b1c] text-white'
                          : 'border-[#151b1c]/15 hover:border-[#151b1c]/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => {
                          patch((p) => ({
                            ...p,
                            business: {
                              ...p.business,
                              categoryIds: on
                                ? p.business.categoryIds.filter((id) => id !== cat.id)
                                : [...p.business.categoryIds, cat.id],
                            },
                          }))
                          clear('categoryIds')
                        }}
                      />
                      {cat.name}
                    </label>
                  )
                })}
              </div>
              {errors.categoryIds && (
                <p className="mt-1.5 text-xs text-[#9b302d]">{errors.categoryIds}</p>
              )}
            </fieldset>

            <div className="sm:col-span-2">
              <FormField id="f-address" label="Workshop or business address" required error={errors.address}>
                <input
                  {...field('address')}
                  className={inputClass(!!errors.address)}
                  value={b.address}
                  autoComplete="street-address"
                  onChange={(e) => {
                    patch((p) => ({ ...p, business: { ...p.business, address: e.target.value } }))
                    clear('address')
                  }}
                />
              </FormField>
            </div>

            <FormField id="f-city" label="City or town" required error={errors.city}>
              <input
                {...field('city')}
                className={inputClass(!!errors.city)}
                value={b.city}
                autoComplete="address-level2"
                onChange={(e) => {
                  patch((p) => ({ ...p, business: { ...p.business, city: e.target.value } }))
                  clear('city')
                }}
              />
            </FormField>

            <FormField id="f-state" label="State" required error={errors.state}>
              <select
                {...field('state')}
                className={inputClass(!!errors.state)}
                value={b.state}
                onChange={(e) => {
                  patch((p) => ({ ...p, business: { ...p.business, state: e.target.value } }))
                  clear('state')
                }}
              >
                <option value="">Select a state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </FormField>
          </div>
        )}

        {/* ----------------------------- 2 · Contact ----------------------------- */}
        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="f-person" label="Contact person" required error={errors.person}>
              <input
                {...field('person')}
                className={inputClass(!!errors.person)}
                value={c.person}
                autoComplete="name"
                onChange={(e) => {
                  patch((p) => ({ ...p, contact: { ...p.contact, person: e.target.value } }))
                  clear('person')
                }}
              />
            </FormField>

            <FormField id="f-email" label="Email" required error={errors.email}>
              <input
                {...field('email')}
                type="email"
                className={inputClass(!!errors.email)}
                value={c.email}
                autoComplete="email"
                onChange={(e) => {
                  patch((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))
                  clear('email')
                }}
              />
            </FormField>

            <FormField id="f-phone" label="Phone number" required error={errors.phone} hint="We use this for order and delivery calls.">
              <input
                {...field('phone')}
                type="tel"
                className={inputClass(!!errors.phone)}
                value={c.phone}
                placeholder="0803 123 4567"
                autoComplete="tel"
                onChange={(e) => {
                  patch((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))
                  clear('phone')
                }}
              />
            </FormField>

            <FormField id="f-whatsapp" label="WhatsApp (optional)" error={errors.whatsapp} hint="Customers can reach you here about your pieces.">
              <input
                {...field('whatsapp')}
                type="tel"
                className={inputClass(!!errors.whatsapp)}
                value={c.whatsapp}
                placeholder="Same as phone if empty"
                onChange={(e) => {
                  patch((p) => ({ ...p, contact: { ...p.contact, whatsapp: e.target.value } }))
                  clear('whatsapp')
                }}
              />
            </FormField>
          </div>
        )}

        {/* ---------------------------- 3 · Documents ---------------------------- */}
        {step === 2 && (
          <DocumentsStep
            profile={profile}
            errors={errors}
            onChange={(fn) => {
              patch(fn)
              clear(...DOCUMENT_SPECS.map((d) => d.kind))
            }}
          />
        )}

        {/* ------------------------------ 4 · Payout ----------------------------- */}
        {step === 3 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Notice tone="info" title="Where we send your money">
                Payouts go to a Nigerian bank account in your name or your business name.
                We never ask for your card details or PIN.
              </Notice>
            </div>

            <div className="sm:col-span-2">
              <FormField id="f-bankName" label="Bank" required error={errors.bankName}>
                <select
                  {...field('bankName')}
                  className={inputClass(!!errors.bankName)}
                  value={x.bankName}
                  onChange={(e) => {
                    patch((p) => ({ ...p, payout: { ...p.payout, bankName: e.target.value } }))
                    clear('bankName')
                  }}
                >
                  <option value="">Select your bank</option>
                  {NIGERIAN_BANKS.map((bank) => (
                    <option key={bank}>{bank}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField id="f-accountNumber" label="Account number" required error={errors.accountNumber}>
              <input
                {...field('accountNumber')}
                inputMode="numeric"
                maxLength={10}
                className={`${inputClass(!!errors.accountNumber)} tabular-nums tracking-[0.12em]`}
                value={x.accountNumber}
                placeholder="0123456789"
                autoComplete="off"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  patch((p) => ({ ...p, payout: { ...p.payout, accountNumber: digits } }))
                  clear('accountNumber')
                }}
              />
            </FormField>

            <FormField
              id="f-accountName"
              label="Account name"
              required
              error={errors.accountName}
              hint="Must match your bank record. We verify this before the first payout."
            >
              <input
                {...field('accountName')}
                className={inputClass(!!errors.accountName)}
                value={x.accountName}
                autoComplete="off"
                onChange={(e) => {
                  patch((p) => ({ ...p, payout: { ...p.payout, accountName: e.target.value } }))
                  clear('accountName')
                }}
              />
            </FormField>
          </div>
        )}

        {/* ------------------------------ 5 · Review ----------------------------- */}
        {step === 4 && (
          <div className="space-y-6">
            <ReviewBlock title="Business" onEdit={() => goTo(0)} rows={[
              ['Name', b.name],
              ['Type', b.type === 'registered' ? `Registered · ${b.rcNumber}` : 'Individual maker'],
              ['Categories', b.categoryIds.map((id) => categories.find((cat) => cat.id === id)?.name).filter(Boolean).join(', ')],
              ['Location', `${b.address}, ${b.city}, ${b.state}`],
            ]} />
            <ReviewBlock title="Contact" onEdit={() => goTo(1)} rows={[
              ['Person', c.person],
              ['Email', c.email],
              ['Phone', c.phone],
              ['WhatsApp', c.whatsapp || 'Not provided'],
            ]} />
            <ReviewBlock title="Documents" onEdit={() => goTo(2)} rows={
              profile.documents.map((d) => [
                DOCUMENT_SPECS.find((s) => s.kind === d.kind)?.label ?? d.kind,
                d.fileName,
              ] as [string, string])
            } />
            <ReviewBlock title="Payouts" onEdit={() => goTo(3)} rows={[
              ['Bank', x.bankName],
              ['Account', `${x.accountNumber.slice(0, 2)}••••••${x.accountNumber.slice(-2)}`],
              ['Account name', x.accountName],
            ]} />

            <div>
              <h3 className="mb-2 font-display text-lg">Verify your contact details</h3>
              <p className="mb-3 text-sm text-[#151b1c]/55">We only accept applications from people who own the email and phone number they give us.</p>
              <VerificationPanel />
            </div>

            <div>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-[#151b1c]/[0.12] p-4">
                <input
                  id="f-agreedToTerms"
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#151b1c]"
                  checked={profile.agreedToTerms}
                  aria-invalid={errors.agreedToTerms ? true : undefined}
                  onChange={(e) => {
                    patch((p) => ({ ...p, agreedToTerms: e.target.checked }))
                    clear('agreedToTerms')
                  }}
                />
                <span className="text-sm leading-6 text-[#151b1c]/70">
                  I confirm the information above is accurate and I agree to the{' '}
                  <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-4">
                    Karta terms
                  </Link>
                  , including the commission and return policies.
                </span>
              </label>
              {(errors.agreedToTerms || showAllErrors) && errors.agreedToTerms && (
                <p className="mt-1.5 text-xs text-[#9b302d]">{errors.agreedToTerms}</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className={secondaryBtn}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {step < ONBOARDING_STEPS.length - 1 ? (
          <button type="button" onClick={next} className={primaryBtn}>
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} className={primaryBtn}>
            Submit application
          </button>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Review block                                                               */
/* -------------------------------------------------------------------------- */

function ReviewBlock({
  title,
  rows,
  onEdit,
}: {
  title: string
  rows: [string, string][]
  onEdit: () => void
}) {
  return (
    <div className="rounded-xl border border-[#151b1c]/[0.08]">
      <div className="flex items-center justify-between border-b border-[#151b1c]/[0.07] px-4 py-3">
        <h3 className="font-display text-lg">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-[#8a6540] underline underline-offset-4">
          Edit
        </button>
      </div>
      <dl className="divide-y divide-[#151b1c]/[0.06]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-[#151b1c]/45">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Documents step                                                             */
/* -------------------------------------------------------------------------- */

function DocumentsStep({
  profile,
  errors,
  onChange,
}: {
  profile: VendorProfile
  errors: FieldErrors
  onChange: (fn: (p: VendorProfile) => VendorProfile) => void
}) {
  const required = new Set(requiredDocumentKinds(profile).map((d) => d.kind))
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({})

  const handle = (kind: DocumentKind) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    if (!DOC_TYPES.includes(file.type)) {
      toast.error('Upload a PDF, JPG or PNG file.')
      return
    }
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      toast.error(`${file.name} is larger than ${MAX_DOC_MB} MB.`)
      return
    }

    // MOCK: only metadata is kept. The real file goes to secure storage via the API.
    onChange((p) => ({
      ...p,
      documents: [
        ...p.documents.filter((d) => d.kind !== kind),
        {
          id: uuid(),
          kind,
          fileName: file.name,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          uploadedAt: new Date().toISOString(),
        },
      ],
    }))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[#151b1c]/55">
        PDF, JPG or PNG, up to {MAX_DOC_MB} MB each. Documents are only seen by the Karta
        verification team.
      </p>

      {DOCUMENT_SPECS.map((spec) => {
        const uploaded = profile.documents.find((d) => d.kind === spec.kind)
        const needed = required.has(spec.kind)
        const err = errors[spec.kind]

        return (
          <div
            key={spec.kind}
            className={`rounded-xl border p-4 ${err ? 'border-[#9b302d]/50' : 'border-[#151b1c]/[0.1]'}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {spec.label}{' '}
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#151b1c]/35">
                    {needed ? 'Required' : 'Optional'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[#151b1c]/45">{spec.hint}</p>
              </div>

              <div className="flex shrink-0 gap-2">
                <input
                  ref={(el) => {
                    inputs.current[spec.kind] = el
                  }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  id={`doc-${spec.kind}`}
                  aria-label={`Upload ${spec.label}`}
                  onChange={handle(spec.kind)}
                />
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => inputs.current[spec.kind]?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploaded ? 'Replace' : 'Upload'}
                </button>
              </div>
            </div>

            {uploaded && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#315d4b]/[0.07] px-3 py-2.5 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-[#315d4b]" />
                <span className="min-w-0 flex-1 truncate">{uploaded.fileName}</span>
                <span className="text-xs text-[#151b1c]/40">{uploaded.sizeKb} KB</span>
                <button
                  type="button"
                  aria-label={`Remove ${uploaded.fileName}`}
                  className={`${dangerBtn} !h-8 !px-3`}
                  onClick={() =>
                    onChange((p) => ({
                      ...p,
                      documents: p.documents.filter((d) => d.id !== uploaded.id),
                    }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {err && <p className="mt-2 text-xs text-[#9b302d]">{err}</p>}
          </div>
        )
      })}
    </div>
  )
}

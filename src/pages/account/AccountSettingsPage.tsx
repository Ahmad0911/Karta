import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Home, KeyRound, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'

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
} from '@/components/portal/ui'
import { CHECKOUT_STATES } from '@/config/checkout'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { MAX_ADDRESSES, selectProfile, useProfileStore, type NotificationPrefs, type SavedAddress } from '@/modules/account/profile.store'
import { useOrdersStore } from '@/modules/orders/orders.store'
import VerificationPanel from '@/components/verification/VerificationPanel'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

type AddressDraft = Omit<SavedAddress, 'id' | 'isDefault'> & { id?: string; makeDefault: boolean }

const blank = (name: string, phone: string): AddressDraft => ({
  label: '',
  fullName: name,
  phone,
  street: '',
  city: '',
  state: '',
  landmark: '',
  makeDefault: false,
})

export default function AccountSettingsPage() {
  useDocumentTitle('Account settings')

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)!
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const deleteAccount = useAuthStore((s) => s.deleteOwnAccount)

  const profile = useProfileStore(selectProfile(user.email))
  const saveAddress = useProfileStore((s) => s.saveAddress)
  const removeAddress = useProfileStore((s) => s.removeAddress)
  const setDefault = useProfileStore((s) => s.setDefaultAddress)
  const setNotifications = useProfileStore((s) => s.setNotifications)
  const erase = useProfileStore((s) => s.erase)

  const orders = useOrdersStore((s) => s.orders)
  const openOrders = orders.filter(
    (o) => o.customerEmail === user.email.trim().toLowerCase() && (o.status === 'paid' || o.status === 'pending_payment'),
  )

  /* ------------------------------- Profile --------------------------------- */
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [profileError, setProfileError] = useState('')

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    const r = updateProfile({ name, phone })
    if (!r.ok) return setProfileError(r.error)
    setProfileError('')
    toast.success('Profile updated')
  }

  /* ------------------------------ Addresses -------------------------------- */
  const [draft, setDraft] = useState<AddressDraft | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [addressError, setAddressError] = useState('')

  const patch = (k: keyof AddressDraft, v: string | boolean) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d))
    setFieldErrors((e) => ({ ...e, [k]: '' }))
    setAddressError('')
  }

  const submitAddress = (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const r = saveAddress(user.email, draft)
    if (!r.ok) {
      setFieldErrors(r.fields ?? {})
      setAddressError(r.error)
      return
    }
    toast.success(draft.id ? 'Address updated' : 'Address saved')
    setDraft(null)
    setFieldErrors({})
  }

  const f = (k: string) => ({
    id: `a-${k}`,
    'aria-invalid': fieldErrors[k] ? (true as const) : undefined,
    'aria-describedby': fieldErrors[k] ? `a-${k}-msg` : undefined,
  })

  /* ---------------------------- Notifications ------------------------------ */
  const prefs = profile.notifications
  const updatePrefs = (next: NotificationPrefs) => {
    setNotifications(user.email, next)
    toast.success('Preferences saved')
  }

  /* ------------------------------- Deletion -------------------------------- */
  const [deleting, setDeleting] = useState(false)
  const [confirmPw, setConfirmPw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [busy, setBusy] = useState(false)

  const confirmDelete = async () => {
    setBusy(true)
    const r = await deleteAccount(confirmPw)
    setBusy(false)
    if (!r.ok) return setDeleteError(r.error)
    erase(user.email)
    toast.success('Your account has been deleted.')
    navigate('/', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-4xl space-y-8 py-12 sm:py-16">
        <PageHeader eyebrow="Account" title="Settings" description="Your details, delivery addresses and how we contact you." />

        {/* -------------------------------- Profile -------------------------------- */}
        <Card>
          <CardHeader title="Personal details" />
          <form onSubmit={saveProfile} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6" noValidate>
            <FormField id="p-name" label="Full name" required>
              <input id="p-name" className={inputClass()} value={name} autoComplete="name" onChange={(e) => { setName(e.target.value); setProfileError('') }} />
            </FormField>
            <FormField id="p-phone" label="Phone number" required hint="Drivers call this number about deliveries.">
              <input id="p-phone" type="tel" className={inputClass()} value={phone} autoComplete="tel" onChange={(e) => { setPhone(e.target.value); setProfileError('') }} aria-describedby="p-phone-msg" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="p-email" label="Email" hint="Your email is your sign-in. To change it, contact support so we can verify it’s really you.">
                <input id="p-email" className={inputClass()} value={user.email} disabled aria-describedby="p-email-msg" />
              </FormField>
            </div>
            {profileError && <p role="alert" className="text-sm text-[#9b302d] sm:col-span-2">{profileError}</p>}
            <div className="flex justify-end sm:col-span-2">
              <button className={primaryBtn}>Save details</button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Verification" description="Confirm you own your email and phone number. Needed to pay for orders and to sell or drive on Karta." />
          <div className="p-5 sm:p-6"><VerificationPanel /></div>
        </Card>

        {/* ------------------------------- Addresses ------------------------------- */}
        <Card>
          <CardHeader
            title="Delivery addresses"
            description={`${profile.addresses.length} of ${MAX_ADDRESSES} saved. Your default fills in at checkout.`}
            action={
              !draft && profile.addresses.length < MAX_ADDRESSES ? (
                <button type="button" className={secondaryBtn} onClick={() => { setDraft(blank(user.name, user.phone ?? '')); setFieldErrors({}); setAddressError('') }}>
                  <Plus className="h-4 w-4" /> Add address
                </button>
              ) : undefined
            }
          />

          {profile.addresses.length === 0 && !draft && (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <MapPin aria-hidden="true" className="h-6 w-6 text-[#8f7651]" />
              <p className="mt-3 text-sm text-[#151b1c]/55">No saved addresses yet. Save one to check out faster.</p>
            </div>
          )}

          <ul className="divide-y divide-[#151b1c]/[0.07]">
            {profile.addresses.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0 text-sm">
                  <p className="flex items-center gap-2 font-semibold">
                    <Home aria-hidden="true" className="h-4 w-4 text-[#8f7651]" /> {a.label}
                    {a.isDefault && <StatusPill tone="green">Default</StatusPill>}
                  </p>
                  <p className="mt-1 text-[#151b1c]/60">{a.fullName} · {a.phone}</p>
                  <p className="text-[#151b1c]/60">{a.street}, {a.city}, {a.state}{a.landmark ? ` (${a.landmark})` : ''}</p>
                </div>
                <div className="flex gap-1">
                  {!a.isDefault && (
                    <button type="button" aria-label={`Make ${a.label} the default address`} className="rounded-full p-2 text-[#151b1c]/55 hover:bg-black/5" onClick={() => { setDefault(user.email, a.id); toast.success('Default address updated') }}>
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" aria-label={`Edit ${a.label}`} className="rounded-full p-2 text-[#151b1c]/55 hover:bg-black/5" onClick={() => { const { isDefault, ...rest } = a; setDraft({ ...rest, landmark: a.landmark ?? '', makeDefault: isDefault }); setFieldErrors({}); setAddressError('') }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Delete ${a.label}`} className="rounded-full p-2 text-[#9b302d]/70 hover:bg-[#9b302d]/10" onClick={() => { if (window.confirm(`Delete “${a.label}”?`)) { removeAddress(user.email, a.id); toast.success('Address deleted') } }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {draft && (
            <form onSubmit={submitAddress} className="grid gap-5 border-t border-[#151b1c]/[0.07] p-5 sm:grid-cols-2 sm:p-6" noValidate>
              <h3 className="font-display text-xl sm:col-span-2">{draft.id ? 'Edit address' : 'New address'}</h3>
              <FormField id="a-label" label="Name this address" required error={fieldErrors.label}>
                <input {...f('label')} className={inputClass(!!fieldErrors.label)} value={draft.label} placeholder="Home, Office…" onChange={(e) => patch('label', e.target.value)} />
              </FormField>
              <FormField id="a-fullName" label="Recipient" required error={fieldErrors.fullName}>
                <input {...f('fullName')} className={inputClass(!!fieldErrors.fullName)} value={draft.fullName} onChange={(e) => patch('fullName', e.target.value)} />
              </FormField>
              <FormField id="a-phone" label="Phone" required error={fieldErrors.phone}>
                <input {...f('phone')} type="tel" className={inputClass(!!fieldErrors.phone)} value={draft.phone} onChange={(e) => patch('phone', e.target.value)} />
              </FormField>
              <FormField id="a-state" label="State" required error={fieldErrors.state}>
                <select {...f('state')} className={inputClass(!!fieldErrors.state)} value={draft.state} onChange={(e) => patch('state', e.target.value)}>
                  <option value="">Select a state</option>
                  {CHECKOUT_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <div className="sm:col-span-2">
                <FormField id="a-street" label="Street address" required error={fieldErrors.street}>
                  <input {...f('street')} className={inputClass(!!fieldErrors.street)} value={draft.street} onChange={(e) => patch('street', e.target.value)} />
                </FormField>
              </div>
              <FormField id="a-city" label="City or town" required error={fieldErrors.city}>
                <input {...f('city')} className={inputClass(!!fieldErrors.city)} value={draft.city} onChange={(e) => patch('city', e.target.value)} />
              </FormField>
              <FormField id="a-landmark" label="Landmark (optional)">
                <input id="a-landmark" className={inputClass()} value={draft.landmark ?? ''} onChange={(e) => patch('landmark', e.target.value)} />
              </FormField>
              <label className="flex cursor-pointer items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="h-4 w-4 accent-[#151b1c]" checked={draft.makeDefault} onChange={(e) => patch('makeDefault', e.target.checked)} />
                Use as my default address
              </label>
              {addressError && <p role="alert" className="text-sm text-[#9b302d] sm:col-span-2">{addressError}</p>}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" className={secondaryBtn} onClick={() => setDraft(null)}>Cancel</button>
                <button className={primaryBtn}>Save address</button>
              </div>
            </form>
          )}
        </Card>

        {/* ----------------------------- Notifications ----------------------------- */}
        <Card>
          <CardHeader title="Notifications" description="Payment receipts and delivery codes are always sent, because you need them to receive your order." />
          <div className="space-y-6 p-5 sm:p-6">
            <fieldset>
              <legend className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">Order updates by</legend>
              <div className="flex flex-wrap gap-3">
                {([['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp']] as const).map(([k, label]) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-full border border-[#151b1c]/15 px-4 py-2 text-sm has-[:checked]:border-[#151b1c] has-[:checked]:bg-[#151b1c]/[0.04]">
                    <input type="checkbox" className="accent-[#151b1c]" checked={prefs.orderUpdates[k]} onChange={(e) => updatePrefs({ ...prefs, orderUpdates: { ...prefs.orderUpdates, [k]: e.target.checked } })} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#151b1c]" checked={prefs.promotions} onChange={(e) => updatePrefs({ ...prefs, promotions: e.target.checked })} />
              <span>
                <span className="block font-medium">Offers and new collections</span>
                <span className="block text-[#151b1c]/50">Occasional emails. Off unless you choose it. Unsubscribe any time.</span>
              </span>
            </label>
          </div>
        </Card>

        {/* -------------------------------- Security ------------------------------- */}
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <KeyRound aria-hidden="true" className="h-5 w-5 text-[#8f7651]" />
            <div>
              <p className="text-sm font-semibold">Password</p>
              <p className="text-xs text-[#151b1c]/50">Use a password you don’t use anywhere else.</p>
            </div>
          </div>
          <Link to="/account/security" className={secondaryBtn}>Change password</Link>
        </Card>

        {/* ----------------------------- Delete account ---------------------------- */}
        <Card className="border-[#9b302d]/20 p-5 sm:p-6">
          <h2 className="font-display text-xl tracking-[-0.02em]">Delete account</h2>
          <p className="mt-1 text-sm leading-6 text-[#151b1c]/55">
            This removes your sign-in, saved addresses and preferences. Order records are kept for the period the law requires.
          </p>

          {user.role !== 'customer' ? (
            <div className="mt-4"><Notice tone="info" title="Contact support to close this account">Vendor and staff accounts are closed by the Karta team so open orders and payouts are settled first.</Notice></div>
          ) : openOrders.length > 0 ? (
            <div className="mt-4"><Notice tone="warning" title="You have orders in progress">You can delete your account once {openOrders.length === 1 ? 'your order is' : 'your orders are'} delivered or resolved.</Notice></div>
          ) : !deleting ? (
            <button type="button" className={`${dangerBtn} mt-4`} onClick={() => setDeleting(true)}>Delete my account…</button>
          ) : (
            <div className="mt-4 max-w-sm space-y-3">
              <FormField id="del-pw" label="Confirm with your password" error={deleteError}>
                <input id="del-pw" type="password" className={inputClass(!!deleteError)} value={confirmPw} autoComplete="current-password" aria-invalid={deleteError ? true : undefined} aria-describedby="del-pw-msg" onChange={(e) => { setConfirmPw(e.target.value); setDeleteError('') }} />
              </FormField>
              <div className="flex gap-2">
                <button type="button" className={secondaryBtn} onClick={() => { setDeleting(false); setConfirmPw(''); setDeleteError('') }}>Keep my account</button>
                <button type="button" className={dangerBtn} disabled={busy || !confirmPw} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}

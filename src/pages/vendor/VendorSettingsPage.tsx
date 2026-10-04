import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Card,
  CardHeader,
  FormField,
  Notice,
  PageHeader,
  inputClass,
  primaryBtn,
  textareaClass,
} from '@/components/portal/ui'
import { COMPANY } from '@/config/company'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import TrustBadge from '@/modules/vendors/components/TrustBadge'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import {
  validateBusiness,
  validateContact,
  type FieldErrors,
} from '@/modules/vendors/lib/onboarding'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'

export default function VendorSettingsPage() {
  useDocumentTitle('Store settings')

  const { email, workspace } = useVendor()
  const { profile } = workspace
  const updateProfile = useVendorStore((s) => s.updateProfile)

  const [description, setDescription] = useState(profile.business.description)
  const [phone, setPhone] = useState(profile.contact.phone)
  const [whatsapp, setWhatsapp] = useState(profile.contact.whatsapp)
  const [errors, setErrors] = useState<FieldErrors>({})

  if (profile.status !== 'approved') {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Store" title="Store settings" />
        <Notice
          tone="info"
          title="Available after approval"
          action={
            <Link to="/vendor/onboarding" className={primaryBtn}>
              Go to application
            </Link>
          }
        >
          Until your application is approved, edit your details from the application form.
        </Notice>
      </div>
    )
  }

  const save = () => {
    // Re-use the onboarding rules so settings can't weaken what was approved.
    const next = {
      ...profile,
      business: { ...profile.business, description },
      contact: { ...profile.contact, phone, whatsapp },
    }
    const found = { ...validateBusiness(next), ...validateContact(next) }
    const relevant: FieldErrors = {}
    for (const k of ['description', 'phone', 'whatsapp']) if (found[k]) relevant[k] = found[k]

    setErrors(relevant)
    if (Object.keys(relevant).length) {
      toast.error('Please fix the highlighted fields.')
      return
    }

    updateProfile(email, (p) => ({
      ...p,
      business: { ...p.business, description: description.trim() },
      contact: { ...p.contact, phone: phone.trim(), whatsapp: whatsapp.trim() },
    }))
    toast.success('Store details saved')
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Store" title="Store settings" actions={<TrustBadge vendorName={profile.business.name} score={profile.trustScore} />} />

      <Card>
        <CardHeader title="Public store details" />
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2">
            <FormField id="s-description" label="About your workshop" error={errors.description} hint="Shown on your vendor profile.">
              <textarea
                id="s-description"
                className={textareaClass(!!errors.description)}
                value={description}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby="s-description-msg"
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="s-phone" label="Phone" error={errors.phone}>
            <input id="s-phone" type="tel" className={inputClass(!!errors.phone)} value={phone} aria-invalid={errors.phone ? true : undefined} aria-describedby="s-phone-msg" onChange={(e) => setPhone(e.target.value)} />
          </FormField>

          <FormField id="s-whatsapp" label="WhatsApp" error={errors.whatsapp}>
            <input id="s-whatsapp" type="tel" className={inputClass(!!errors.whatsapp)} value={whatsapp} aria-invalid={errors.whatsapp ? true : undefined} aria-describedby="s-whatsapp-msg" onChange={(e) => setWhatsapp(e.target.value)} />
          </FormField>

          <div className="flex justify-end sm:col-span-2">
            <button type="button" className={primaryBtn} onClick={save}>
              Save changes
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Locked details" description="Changing these needs a quick check from our team." />
        <dl className="divide-y divide-[#151b1c]/[0.06] text-sm">
          {[
            ['Business name', profile.business.name],
            ['Address', `${profile.business.address}, ${profile.business.city}, ${profile.business.state}`],
            ['Email', profile.contact.email],
            ['Payout account', `${profile.payout.bankName} ••••${profile.payout.accountNumber.slice(-4)}`],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[11rem_1fr] sm:px-6">
              <dt className="text-[#151b1c]/45">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-[#151b1c]/[0.07] px-5 py-4 text-xs sm:px-6">
          <a href={`mailto:${COMPANY.vendorEmail}?subject=${encodeURIComponent('Update my vendor details')}`} className="font-semibold text-[#8a6540] underline underline-offset-4">
            Contact the vendor team
          </a>
        </div>
      </Card>
    </div>
  )
}

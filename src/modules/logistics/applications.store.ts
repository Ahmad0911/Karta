import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { uuid } from '@/lib/id'
import { safeStorage } from '@/lib/safeStorage'
import { useAuthStore } from '@/store/auth.store'
import { isNigerianPhone } from '@/modules/vendors/lib/onboarding'

/* -------------------------------------------------------------------------- */
/* Driver applications (MOCK of the logistics-partner onboarding service)     */
/* -------------------------------------------------------------------------- */
/**
 * Anyone can APPLY, only staff can APPROVE. Applicants keep a plain customer
 * account until an admin verifies them; approval is what grants the driver
 * role. The server must enforce this; nothing here is a security boundary.
 */

export type VehicleType = 'motorbike' | 'car' | 'van' | 'truck'

export const VEHICLES: { id: VehicleType; label: string; hint: string }[] = [
  { id: 'motorbike', label: 'Motorbike', hint: 'Small items, lamps, decor' },
  { id: 'car', label: 'Car', hint: 'Small furniture and boxed items' },
  { id: 'van', label: 'Van', hint: 'Chairs, tables, small sofas' },
  { id: 'truck', label: 'Truck', hint: 'Beds, wardrobes, large sofas' },
]

export type LogisticsDocKind = 'government_id' | 'drivers_licence' | 'vehicle_papers'

export const LOGISTICS_DOCS: { kind: LogisticsDocKind; label: string; hint: string }[] = [
  { kind: 'government_id', label: 'Government-issued ID', hint: 'NIN slip, international passport or voter’s card.' },
  { kind: 'drivers_licence', label: 'Driver’s licence', hint: 'Valid and not expired. Both sides if possible.' },
  { kind: 'vehicle_papers', label: 'Vehicle papers', hint: 'Vehicle licence / registration for the vehicle you will use.' },
]

export interface LogisticsDocument {
  kind: LogisticsDocKind
  fileName: string
  sizeKb: number
}

export interface ApplicationInput {
  name: string
  phone: string
  state: string
  city: string
  vehicle: VehicleType | ''
  plateNumber: string
  licenceNumber: string
  experienceYears: string
  guarantorName: string
  guarantorPhone: string
  documents: LogisticsDocument[]
  agreed: boolean
}

export type ApplicationStatus = 'under_review' | 'approved' | 'rejected'

export interface LogisticsApplication {
  email: string
  name: string
  phone: string
  state: string
  city: string
  vehicle: VehicleType
  plateNumber: string
  licenceNumber: string
  experienceYears: number
  guarantor: { name: string; phone: string }
  documents: LogisticsDocument[]
  status: ApplicationStatus
  note?: string
  submittedAt: string
  decidedAt?: string
  decidedBy?: string
  log: { id: string; at: string; by: string; action: 'submitted' | 'approved' | 'rejected'; note?: string }[]
}

type Errors = Record<string, string>
type Result = { ok: true } | { ok: false; error: string; fields?: Errors }

export function validateApplication(i: ApplicationInput): Errors {
  const e: Errors = {}
  if (i.name.trim().length < 2) e.name = 'Enter your full name.'
  if (!isNigerianPhone(i.phone)) e.phone = 'Enter a valid Nigerian phone number.'
  if (!i.state) e.state = 'Choose the state you operate in.'
  if (i.city.trim().length < 2) e.city = 'Enter your city or town.'
  if (!i.vehicle) e.vehicle = 'Choose the vehicle you will use.'
  if (!/^[A-Za-z0-9][A-Za-z0-9\s-]{4,11}$/.test(i.plateNumber.trim())) e.plateNumber = 'Enter the plate number, for example ABC-123DE.'
  if (!/^[A-Za-z0-9-]{6,20}$/.test(i.licenceNumber.trim())) e.licenceNumber = 'Enter your driver’s licence number (6 to 20 letters and digits).'

  const years = Number(i.experienceYears)
  if (i.experienceYears.trim() === '' || !Number.isInteger(years) || years < 0 || years > 60) {
    e.experienceYears = 'Enter your years of driving experience, as a whole number.'
  }

  if (i.guarantorName.trim().length < 2) e.guarantorName = 'Enter your guarantor’s full name.'
  if (!isNigerianPhone(i.guarantorPhone)) e.guarantorPhone = 'Enter a valid Nigerian number for your guarantor.'
  else if (i.guarantorPhone.replace(/\D/g, '').slice(-10) === i.phone.replace(/\D/g, '').slice(-10)) {
    e.guarantorPhone = 'Your guarantor needs a different phone number from yours.'
  }

  for (const d of LOGISTICS_DOCS) {
    if (!i.documents.some((x) => x.kind === d.kind)) e[d.kind] = `Upload your ${d.label.toLowerCase()}.`
  }

  if (!i.agreed) e.agreed = 'Please accept the driver terms to apply.'
  return e
}

interface State {
  byEmail: Record<string, LogisticsApplication>
  submit: (email: string, input: ApplicationInput) => Result
  decide: (email: string, decision: 'approve' | 'reject', note: string) => Result
}

const key = (e: string) => e.trim().toLowerCase()
const now = () => new Date().toISOString()

export const useApplicationsStore = create<State>()(
  persist(
    (set, get) => ({
      byEmail: {},

      submit: (rawEmail, input) => {
        const email = key(rawEmail)
        const me = useAuthStore.getState().user

        // You can only apply for yourself.
        if (!me || key(me.email) !== email) return { ok: false, error: 'Please sign in to apply.' }
        if (me.role !== 'customer') return { ok: false, error: 'This account type can’t apply as a driver. Use a separate email address.' }

        const existing = get().byEmail[email]
        if (existing && existing.status !== 'rejected') {
          return { ok: false, error: existing.status === 'approved' ? 'You’re already approved.' : 'Your application is already under review.' }
        }

        const fields = validateApplication(input)
        if (Object.keys(fields).length) return { ok: false, error: 'Please fix the highlighted fields.', fields }

        const app: LogisticsApplication = {
          email,
          name: input.name.trim(),
          phone: input.phone.trim(),
          state: input.state,
          city: input.city.trim(),
          vehicle: input.vehicle as VehicleType,
          plateNumber: input.plateNumber.trim().toUpperCase(),
          licenceNumber: input.licenceNumber.trim().toUpperCase(),
          experienceYears: Number(input.experienceYears),
          guarantor: { name: input.guarantorName.trim(), phone: input.guarantorPhone.trim() },
          documents: input.documents,
          status: 'under_review',
          submittedAt: now(),
          log: [...(existing?.log ?? []), { id: uuid(), at: now(), by: email, action: 'submitted' }],
        }

        set((s) => ({ byEmail: { ...s.byEmail, [email]: app } }))
        return { ok: true }
      },

      decide: (rawEmail, decision, note) => {
        const admin = useAuthStore.getState().user
        if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
          return { ok: false, error: 'Only Karta staff can review driver applications.' }
        }

        const email = key(rawEmail)
        const app = get().byEmail[email]
        if (!app) return { ok: false, error: 'Application not found.' }
        if (app.status !== 'under_review') return { ok: false, error: 'This application has already been decided.' }

        const trimmed = note.trim()
        if (decision === 'reject' && trimmed.length < 10) {
          return { ok: false, error: 'Tell the applicant why (at least 10 characters).' }
        }

        if (decision === 'approve') {
          // Drivers phone customers: their number must be verified first.
          if (!useAuthStore.getState().accounts[email]?.user.phoneVerified) {
            return { ok: false, error: 'The applicant hasn’t verified their phone number yet.' }
          }

          // Never approve an incomplete file, even if the UI allowed it.
          if (Object.keys(validateApplication({ ...app, vehicle: app.vehicle, experienceYears: String(app.experienceYears), guarantorName: app.guarantor.name, guarantorPhone: app.guarantor.phone, agreed: true })).length) {
            return { ok: false, error: 'This application is incomplete and cannot be approved.' }
          }
          const granted = useAuthStore.getState().grantLogisticsRole(email)
          if (!granted.ok) return granted
        }

        set((s) => ({
          byEmail: {
            ...s.byEmail,
            [email]: {
              ...app,
              status: decision === 'approve' ? 'approved' : 'rejected',
              note: decision === 'reject' ? trimmed : undefined,
              decidedAt: now(),
              decidedBy: admin.email,
              log: [...app.log, { id: uuid(), at: now(), by: admin.email, action: decision === 'approve' ? 'approved' : 'rejected', note: trimmed || undefined }],
            },
          },
        }))

        return { ok: true }
      },
    }),
    { name: 'karta-driver-applications', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

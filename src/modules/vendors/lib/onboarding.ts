import type { User } from '@/types'
import type { VendorProfile } from '../types'
import { DOCUMENT_SPECS } from '../data/reference'

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

export const ONBOARDING_STEPS = [
  { id: 'business', label: 'Business' },
  { id: 'contact', label: 'Contact' },
  { id: 'documents', label: 'Documents' },
  { id: 'payout', label: 'Payouts' },
  { id: 'review', label: 'Review' },
] as const

export type FieldErrors = Record<string, string>

/* -------------------------------------------------------------------------- */
/* Patterns                                                                   */
/* -------------------------------------------------------------------------- */

const NG_PHONE = /^(?:\+?234|0)[789][01]\d{8}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NUBAN = /^\d{10}$/

export const cleanPhone = (value: string) => value.replace(/[\s()-]/g, '')
export const isNigerianPhone = (value: string) => NG_PHONE.test(cleanPhone(value))

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createEmptyProfile(user: User): VendorProfile {
  return {
    status: 'draft',
    trustScore: 0,
    verificationLog: [],
    onboardingStep: 0,
    business: {
      name: user.businessName ?? '',
      type: 'individual',
      rcNumber: '',
      description: '',
      categoryIds: [],
      address: '',
      city: '',
      state: '',
    },
    contact: {
      person: user.name,
      phone: user.phone ?? '',
      whatsapp: '',
      email: user.email,
    },
    documents: [],
    payout: { bankName: '', accountNumber: '', accountName: '' },
    agreedToTerms: false,
  }
}

/* -------------------------------------------------------------------------- */
/* Validation (per step)                                                      */
/* -------------------------------------------------------------------------- */

export function validateBusiness(p: VendorProfile): FieldErrors {
  const e: FieldErrors = {}
  const b = p.business

  if (b.name.trim().length < 2) e.name = 'Enter your business or workshop name.'

  if (b.type === 'registered' && b.rcNumber.trim().length < 3) {
    e.rcNumber = 'Enter your CAC registration number (for example RC1234567 or BN1234567).'
  }

  if (b.description.trim().length < 40) {
    e.description = 'Tell us a little more: at least 40 characters about what you make.'
  }

  if (b.categoryIds.length === 0) {
    e.categoryIds = 'Choose at least one category you sell.'
  }

  if (b.address.trim().length < 5) e.address = 'Enter your workshop or business address.'
  if (b.city.trim().length < 2) e.city = 'Enter your city or town.'
  if (!b.state) e.state = 'Choose your state.'

  return e
}

export function validateContact(p: VendorProfile): FieldErrors {
  const e: FieldErrors = {}
  const c = p.contact

  if (c.person.trim().length < 2) e.person = 'Enter the contact person’s full name.'

  if (!isNigerianPhone(c.phone)) {
    e.phone = 'Enter a valid Nigerian number, for example 0803 123 4567.'
  }

  if (c.whatsapp.trim() && !isNigerianPhone(c.whatsapp)) {
    e.whatsapp = 'Enter a valid Nigerian WhatsApp number, or leave it empty.'
  }

  if (!EMAIL.test(c.email.trim())) e.email = 'Enter a valid email address.'

  return e
}

export function requiredDocumentKinds(p: VendorProfile) {
  return DOCUMENT_SPECS.filter(
    (d) =>
      d.required === 'always' ||
      (d.required === 'registered' && p.business.type === 'registered'),
  )
}

export function validateDocuments(p: VendorProfile): FieldErrors {
  const e: FieldErrors = {}

  for (const spec of requiredDocumentKinds(p)) {
    if (!p.documents.some((d) => d.kind === spec.kind)) {
      e[spec.kind] = `Upload your ${spec.label.toLowerCase()}.`
    }
  }

  return e
}

export function validatePayout(p: VendorProfile): FieldErrors {
  const e: FieldErrors = {}
  const x = p.payout

  if (!x.bankName) e.bankName = 'Choose your bank.'
  if (!NUBAN.test(x.accountNumber.trim())) {
    e.accountNumber = 'Account numbers have exactly 10 digits.'
  }
  if (x.accountName.trim().length < 2) {
    e.accountName = 'Enter the account name exactly as your bank shows it.'
  }

  return e
}

export function validateReview(p: VendorProfile): FieldErrors {
  return p.agreedToTerms
    ? {}
    : { agreedToTerms: 'Please accept the vendor terms to submit.' }
}

const VALIDATORS = [
  validateBusiness,
  validateContact,
  validateDocuments,
  validatePayout,
  validateReview,
] as const

export const validateStep = (p: VendorProfile, step: number): FieldErrors =>
  VALIDATORS[step]?.(p) ?? {}

/** First step that still has problems, or -1 when the application is ready. */
export function firstIncompleteStep(p: VendorProfile): number {
  return VALIDATORS.findIndex((validate) => Object.keys(validate(p)).length > 0)
}

/** Steps 0–3 only (everything except the final agreement). */
export function completionPercent(p: VendorProfile): number {
  const done = VALIDATORS.slice(0, 4).filter(
    (validate) => Object.keys(validate(p)).length === 0,
  ).length

  return Math.round((done / 4) * 100)
}

export const isEditable = (p: VendorProfile) =>
  p.status === 'draft' || p.status === 'changes_requested'

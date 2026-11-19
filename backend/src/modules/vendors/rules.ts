import { normalisePhone } from '../../platform/validate.ts'

/** The vendor-verification rules. Kept pure so they're easy to test and to reuse. */

export interface Business { name: string; type: 'individual' | 'registered'; rcNumber: string; description: string; categoryIds: string[]; address: string; city: string; state: string }
export interface Contact { person: string; phone: string; whatsapp: string; email: string }
export interface Payout { bankName: string; accountNumber: string; accountName: string }
export interface Doc { kind: string; fileName: string }

export const emptyBusiness = (name: string): Business => ({ name, type: 'individual', rcNumber: '', description: '', categoryIds: [], address: '', city: '', state: '' })
export const emptyContact = (person: string, email: string, phone: string): Contact => ({ person, phone, whatsapp: '', email })
export const emptyPayout = (): Payout => ({ bankName: '', accountNumber: '', accountName: '' })

const NG_PHONE = /^(?:\+?234|0)[789][01]\d{8}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const clean = (s: string) => s.replace(/[\s()-]/g, '')

export function requiredDocs(type: Business['type']): string[] {
  return type === 'registered' ? ['government_id', 'business_registration', 'proof_of_address'] : ['government_id', 'proof_of_address']
}

/** Everything that must be true before a human even looks at the application. */
export function completenessErrors(b: Business, c: Contact, p: Payout, docs: Doc[], agreed: boolean): Record<string, string> {
  const e: Record<string, string> = {}
  if (b.name.trim().length < 2) e['business.name'] = 'Enter your business or workshop name.'
  if (b.type === 'registered' && b.rcNumber.trim().length < 3) e['business.rcNumber'] = 'Enter your CAC registration number.'
  if (b.description.trim().length < 40) e['business.description'] = 'Tell us a little more: at least 40 characters about what you make.'
  if (b.categoryIds.length === 0) e['business.categoryIds'] = 'Choose at least one category you sell.'
  if (b.address.trim().length < 5) e['business.address'] = 'Enter your workshop or business address.'
  if (b.city.trim().length < 2) e['business.city'] = 'Enter your city or town.'
  if (!b.state) e['business.state'] = 'Choose your state.'

  if (c.person.trim().length < 2) e['contact.person'] = 'Enter the contact person’s full name.'
  if (!NG_PHONE.test(clean(c.phone))) e['contact.phone'] = 'Enter a valid Nigerian phone number.'
  if (c.whatsapp.trim() && !NG_PHONE.test(clean(c.whatsapp))) e['contact.whatsapp'] = 'Enter a valid Nigerian WhatsApp number, or leave it empty.'
  if (!EMAIL.test(c.email.trim())) e['contact.email'] = 'Enter a valid email address.'

  for (const kind of requiredDocs(b.type)) if (!docs.some((d) => d.kind === kind)) e[`documents.${kind}`] = `Upload your ${kind.replace(/_/g, ' ')}.`

  if (!p.bankName) e['payout.bankName'] = 'Choose your bank.'
  if (!/^\d{10}$/.test(p.accountNumber.trim())) e['payout.accountNumber'] = 'Account numbers have exactly 10 digits.'
  if (p.accountName.trim().length < 2) e['payout.accountName'] = 'Enter the account name exactly as your bank shows it.'

  if (!agreed) e.agreedToTerms = 'Please accept the vendor terms to submit.'
  return e
}

/* ------------------------------ Decisions -------------------------------- */

export type Status = 'draft' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'suspended'
export type Decision = 'approve' | 'request_changes' | 'reject' | 'suspend' | 'reinstate'

export const DECISIONS: Record<Decision, { from: Status[]; to: Status; log: string; needsNote: boolean }> = {
  approve: { from: ['under_review'], to: 'approved', log: 'approved', needsNote: false },
  request_changes: { from: ['under_review'], to: 'changes_requested', log: 'changes_requested', needsNote: true },
  reject: { from: ['under_review', 'changes_requested'], to: 'rejected', log: 'rejected', needsNote: true },
  suspend: { from: ['approved'], to: 'suspended', log: 'suspended', needsNote: true },
  reinstate: { from: ['suspended'], to: 'approved', log: 'reinstated', needsNote: false },
}

export const isEditable = (s: Status) => s === 'draft' || s === 'changes_requested'

/* ------------------------------ Fraud signals ---------------------------- */

const STOP = new Set(['ltd', 'limited', 'enterprises', 'nigeria', 'and', 'the'])
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w))
export const overlaps = (a: string, b: string) => {
  const set = new Set(words(a))
  return words(b).some((w) => set.has(w))
}

export { normalisePhone }

import type { DocumentKind } from '../types'

/** Reference data for vendor forms. Replace with API-driven lists later. */

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const

export const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank',
  'First Bank of Nigeria', 'First City Monument Bank (FCMB)',
  'Globus Bank', 'Guaranty Trust Bank (GTBank)', 'Heritage Bank',
  'Keystone Bank', 'Kuda Microfinance Bank', 'Moniepoint Microfinance Bank',
  'OPay', 'PalmPay', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank',
  'Standard Chartered Bank', 'Sterling Bank', 'Union Bank',
  'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
] as const

export interface DocumentSpec {
  kind: DocumentKind
  label: string
  hint: string
  /** Required for every vendor, or only registered businesses. */
  required: 'always' | 'registered' | 'optional'
}

export const DOCUMENT_SPECS: DocumentSpec[] = [
  {
    kind: 'government_id',
    label: 'Government-issued ID',
    hint: 'NIN slip, international passport, driver’s licence or voter’s card.',
    required: 'always',
  },
  {
    kind: 'business_registration',
    label: 'CAC registration certificate',
    hint: 'Certificate of incorporation or business-name registration.',
    required: 'registered',
  },
  {
    kind: 'proof_of_address',
    label: 'Proof of workshop or business address',
    hint: 'Utility bill or tenancy document from the last 3 months.',
    required: 'always',
  },
  {
    kind: 'workshop_photo',
    label: 'Workshop or showroom photo',
    hint: 'Helps us understand how your pieces are made. Strongly recommended.',
    required: 'optional',
  },
]

/** Finishes a vendor can tick on a listing. */
export const FINISH_PALETTE = [
  { name: 'Ivory', hex: '#E9E2D3' },
  { name: 'Sand', hex: '#C9B79C' },
  { name: 'Natural', hex: '#C8A37A' },
  { name: 'Walnut', hex: '#6B5844' },
  { name: 'Charcoal', hex: '#3B4143' },
  { name: 'Black', hex: '#1C1C1C' },
  { name: 'Moss', hex: '#4D6A4F' },
  { name: 'Clay', hex: '#B5715A' },
  { name: 'Navy', hex: '#2B3A55' },
  { name: 'Grey', hex: '#9A9A94' },
] as const

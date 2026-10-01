/**
 * Single source of truth for company details, contact channels and policy
 * numbers used across the public pages.
 *
 * TODO before launch: replace every value marked CONFIRM.
 * Empty social URLs are hidden automatically by the footer.
 */
export const COMPANY = {
  brand: 'Karta',
  legalName: 'Hamd Tech Ltd',
  location: 'Abuja, Nigeria',

  /** CONFIRM: real support inbox. Can also be set with VITE_SUPPORT_EMAIL. */
  supportEmail:
    (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ??
    'support@karta.example',

  /** CONFIRM: inbox that receives vendor applications. */
  vendorEmail:
    (import.meta.env.VITE_VENDOR_EMAIL as string | undefined) ??
    'vendors@karta.example',

  supportHours: 'Monday to Saturday, 9am to 6pm (WAT)',

  /** CONFIRM: paste the real profile URLs. Leave '' to hide an icon. */
  socials: {
    instagram: '',
    facebook: '',
    youtube: '',
  },
} as const

/** CONFIRM: business policy numbers used by the Returns and Shipping pages. */
export const POLICY = {
  returnWindowDays: 7,
  refundProcessingDays: '5 to 10 working days',
  paymentProviders: 'Paystack and Flutterwave',
} as const
export const STYLES = ['Modern', 'Minimalist', 'Traditional', 'African contemporary', 'Scandinavian', 'Rustic', 'Industrial', 'Luxury', 'Boho'] as const

export const NEEDED_WITHIN = [
  { days: undefined, label: 'Flexible' },
  { days: 14, label: 'Within 2 weeks' },
  { days: 30, label: 'Within a month' },
  { days: 60, label: 'Within 2 months' },
  { days: 90, label: 'Within 3 months' },
] as const

export const LIMITS = {
  title: [5, 80],
  description: [20, 1500],
  note: [10, 500],
  maxImages: 4,
  maxActive: 3,
  maxPerDay: 5,
  offerHours: 72,
  openDays: 30,
  acceptedDays: 7,
  maxHeldOffers: 5,
  price: [1000, 50_000_000],
  days: [1, 180],
} as const

/**
 * Catches attempts to take the deal off Karta: emails, links, phone numbers,
 * and "message me on WhatsApp" style phrases. Off-platform deals are the main
 * way scams happen, and they also strip the buyer's refund protection.
 */
export function containsContactInfo(text: string): boolean {
  const t = text.toLowerCase()
  if (/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i.test(t)) return true
  // spelled-out addresses: "ade at gmail dot com"
  if (/\b[a-z0-9._-]+\s+at\s+[a-z0-9-]+\s+dot\s+[a-z]{2,}\b/i.test(t)) return true
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ng|net|org|co|me|io)\b)/i.test(t)) return true
  // 9+ digits, even when split by spaces, dots or dashes (0803 123 4567, +234-803...)
  if (/(\+?\d[\s().-]*){9,}/.test(t)) return true
  if (/\b(whats\s?app|telegram|signal|dm me|inbox me|call me|text me|my number|reach me|contact me on)\b/.test(t)) return true
  return false
}

export const CONTACT_MESSAGE =
  'Please keep contact details out of this message. Everything happens safely inside Karta, and that keeps your payment protected.'

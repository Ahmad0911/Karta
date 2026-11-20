/** Mirrors the web app's rules. The SERVER is the one that enforces them. */
export const LIMITS = {
  title: [5, 80], description: [20, 1500], note: [10, 500], maxImages: 4, maxActive: 3, maxPerDay: 5,
  offerHours: 72, priceKobo: [100_000, 5_000_000_000], days: [1, 180],
} as const

/**
 * Deals that leave Karta also leave payment protection. Block anything that looks like a way to
 * reach someone outside it: emails, links, phone numbers (even split up), and "WhatsApp me".
 */
export function containsContactInfo(text: string): boolean {
  const t = text.toLowerCase()
  if (/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i.test(t)) return true
  if (/\b[a-z0-9._-]+\s+at\s+[a-z0-9-]+\s+dot\s+[a-z]{2,}\b/i.test(t)) return true
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ng|net|org|co|me|io)\b)/i.test(t)) return true
  if (/(\+?\d[\s().-]*){9,}/.test(t)) return true
  if (/\b(whats\s?app|telegram|signal|dm me|inbox me|call me|text me|my number|reach me|contact me on)\b/.test(t)) return true
  return false
}
export const CONTACT_MESSAGE = 'Please keep contact details out of this message. Everything happens safely inside Karta, and that keeps your payment protected.'

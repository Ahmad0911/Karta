/** Canonical Nigerian phone form: 234XXXXXXXXXX (digits only). */
export function normalisePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('234')) return d
  if (d.startsWith('0')) return `234${d.slice(1)}`
  return d
}

export const samePhone = (a: string, b: string) =>
  Boolean(a && b) && normalisePhone(a) === normalisePhone(b)

import { cleanPhone } from '@/modules/vendors/lib/onboarding'
import type { VendorRecord } from '@/modules/vendors/hooks/useAllVendors'

/**
 * Cheap, explainable signals that help a human reviewer. They never approve
 * or reject on their own; a person always makes the decision.
 */

export interface Signal {
  level: 'warning' | 'info'
  text: string
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['ltd', 'limited', 'enterprises', 'nigeria', 'and', 'the'].includes(w))

const overlaps = (a: string, b: string) => {
  const set = new Set(words(a))
  return words(b).some((w) => set.has(w))
}

export function signalsFor(record: VendorRecord, all: VendorRecord[]): Signal[] {
  const { profile } = record.workspace
  const out: Signal[] = []
  const others = all.filter((v) => v.email !== record.email)

  /* Bank account name vs who they say they are */
  const acct = profile.payout.accountName
  if (
    acct &&
    !overlaps(acct, profile.business.name) &&
    !overlaps(acct, profile.contact.person)
  ) {
    out.push({
      level: 'warning',
      text: `Payout account name “${acct}” doesn’t resemble the business name or contact person. Confirm the account belongs to them.`,
    })
  }

  /* Same phone / bank account / business name as another vendor */
  const phone = cleanPhone(profile.contact.phone)
  for (const o of others) {
    const op = o.workspace.profile
    const label = op.business.name || o.email

    if (phone && cleanPhone(op.contact.phone) === phone) {
      out.push({ level: 'warning', text: `Same phone number as “${label}” (${op.status.replace('_', ' ')}).` })
    }

    if (
      profile.payout.accountNumber &&
      op.payout.accountNumber === profile.payout.accountNumber &&
      op.payout.bankName === profile.payout.bankName
    ) {
      out.push({ level: 'warning', text: `Same bank account as “${label}” (${op.status.replace('_', ' ')}).` })
    }

    if (
      profile.business.name &&
      op.business.name.trim().toLowerCase() === profile.business.name.trim().toLowerCase()
    ) {
      out.push({ level: 'info', text: `Same business name as another vendor (“${label}”).` })
    }

    if (op.status === 'rejected' && (cleanPhone(op.contact.phone) === phone)) {
      out.push({ level: 'warning', text: `A previously REJECTED application used this phone number.` })
    }
  }

  /* Registered but no RC number, or malformed */
  if (profile.business.type === 'registered' && !/^(RC|BN|IT)\s?\d{3,}$/i.test(profile.business.rcNumber.trim())) {
    out.push({
      level: 'info',
      text: 'CAC number doesn’t look like RC/BN/IT followed by digits. Check it on the CAC public search.',
    })
  }

  if (!profile.documents.some((d) => d.kind === 'workshop_photo')) {
    out.push({ level: 'info', text: 'No workshop or showroom photo was provided.' })
  }

  return out
}

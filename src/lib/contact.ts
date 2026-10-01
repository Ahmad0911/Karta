/* mailto */

interface MailtoOptions {
  to: string
  subject?: string
  body?: string
}

/** Builds a mailto: link. Works without any backend. */
export function mailtoLink({ to, subject, body }: MailtoOptions) {
  const query = new URLSearchParams()

  if (subject) query.set('subject', subject)
  if (body) query.set('body', body)

  // URLSearchParams encodes spaces as "+", which mail apps show literally.
  const qs = query.toString().replace(/\+/g, '%20')

  return `mailto:${to}${qs ? `?${qs}` : ''}`
}

/* Validation */

export const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

/* Newsletter */

const STORAGE_KEY = 'karta:newsletter'

export type SubscribeResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Subscribes an email address.
 *
 * - If VITE_NEWSLETTER_ENDPOINT is set, the address is POSTed there as JSON
 *   ({ email }). Any 2xx response counts as success.
 * - Otherwise the address is kept in localStorage only. Wire the endpoint
 *   before launch.
 */
export async function subscribeToNewsletter(
  email: string,
): Promise<SubscribeResult> {
  const address = email.trim().toLowerCase()

  if (!isEmail(address)) {
    return { ok: false, message: 'Enter a valid email address.' }
  }

  const endpoint = import.meta.env.VITE_NEWSLETTER_ENDPOINT as
    | string
    | undefined

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      })

      if (!response.ok) throw new Error(String(response.status))

      return { ok: true }
    } catch {
      return {
        ok: false,
        message: 'We couldn’t subscribe you just now. Please try again.',
      }
    }
  }

  console.warn(
    '[newsletter] VITE_NEWSLETTER_ENDPOINT is not set. The address was saved in this browser only and no email was sent.',
  )

  try {
    const existing: string[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    )

    if (!existing.includes(address)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, address]))
    }
  } catch {
    /* storage unavailable: still treat as success in dev */
  }

  return { ok: true }
}
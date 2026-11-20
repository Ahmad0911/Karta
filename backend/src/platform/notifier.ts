/**
 * How the API reaches people. Implement this with your SMS and email providers
 * (Termii, Africa's Talking, Twilio, SES, Resend…). Nothing else changes.
 */
export interface Message {
  channel: 'email' | 'sms'
  to: string
  template: 'verify_code' | 'reset_code'
  code: string
}

export interface Notifier {
  send(m: Message): Promise<void>
}

/** DEVELOPMENT ONLY: prints codes. Config refuses this in production. */
export const consoleNotifier: Notifier = {
  async send(m) {
    process.stdout.write(`[notify:dev] ${m.channel} to ${m.to}: ${m.template} code ${m.code}\n`)
  },
}

export const noopNotifier: Notifier = { async send() {} }

/** Keeps messages in memory so tests can read them. */
export class MemoryNotifier implements Notifier {
  sent: Message[] = []
  async send(m: Message) {
    this.sent.push(m)
  }
  last(to: string) {
    return [...this.sent].reverse().find((m) => m.to === to)
  }
}

/* -------------------------------------------------------------------------- */
/* Live providers: Termii (SMS, Nigerian numbers) and Resend (email)           */
/* -------------------------------------------------------------------------- */

export interface LiveNotifierConfig {
  termii: { apiKey: string; senderId: string; channel: 'generic' | 'dnd'; baseUrl?: string }
  resend: { apiKey: string; from: string; baseUrl?: string }
}

export class NotifyError extends Error {}

/** Termii wants international digits with no plus: 2348031234567. */
export function toInternationalNg(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (d.startsWith('234')) return d
  if (d.startsWith('0')) return `234${d.slice(1)}`
  return `234${d}`
}

const COPY: Record<Message['template'], (code: string) => { subject: string; text: string }> = {
  verify_code: (code) => ({
    subject: 'Your Karta verification code',
    text: `Your Karta verification code is ${code}. It expires in 10 minutes. Never share this code: Karta staff will never ask for it.`,
  }),
  reset_code: (code) => ({
    subject: 'Reset your Karta password',
    text: `Your Karta password reset code is ${code}. It expires in 10 minutes. If you didn't ask for this, you can ignore it and your password stays the same.`,
  }),
}

/**
 * Sends the real thing. Keys are only ever used in the Authorization header / request body to the provider.
 * Errors say which channel failed, never the key, the number, the address or the code.
 */
export function createLiveNotifier(cfg: LiveNotifierConfig, fetchImpl: typeof fetch = fetch): Notifier {
  async function post(url: string, init: { headers?: Record<string, string>; body: unknown }, what: string) {
    let res: Response
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...init.headers },
        body: JSON.stringify(init.body),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new NotifyError(`${what} could not be reached.`)
    }
    if (!res.ok) throw new NotifyError(`${what} rejected the message (${res.status}).`)
  }

  return {
    async send(m) {
      const { subject, text } = COPY[m.template](m.code)
      if (m.channel === 'sms') {
        await post(`${cfg.termii.baseUrl ?? 'https://api.ng.termii.com'}/api/sms/send`, {
          body: { api_key: cfg.termii.apiKey, to: toInternationalNg(m.to), from: cfg.termii.senderId, sms: text, type: 'plain', channel: cfg.termii.channel },
        }, 'The SMS provider')
      } else {
        await post(`${cfg.resend.baseUrl ?? 'https://api.resend.com'}/emails`, {
          headers: { Authorization: `Bearer ${cfg.resend.apiKey}` },
          body: { from: cfg.resend.from, to: [m.to], subject, text },
        }, 'The email provider')
      }
    },
  }
}

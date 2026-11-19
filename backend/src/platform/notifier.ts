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

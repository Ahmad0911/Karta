export type Channel = 'email' | 'phone'

export type RequestResult =
  | {
      ok: true
      /** Epoch ms when another code may be requested. */
      resendAfter: number
      /** DEV ONLY: the code, because no SMS/email is actually sent. */
      devCode?: string
    }
  | { ok: false; error: string; retryAfter?: number }

export type ConfirmResult = { ok: true } | { ok: false; error: string }

export interface VerificationProvider {
  id: string
  request(channel: Channel, target: string): Promise<RequestResult>
  confirm(channel: Channel, target: string, code: string): Promise<ConfirmResult>
}

export const CODE_RULES = {
  length: 6,
  ttlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  resendMs: 60 * 1000,
  maxSendsPerHour: 5,
} as const

import type { Deps } from '../../deps.ts'
import { newId, randomDigits, randomToken, safeEqual, sha256 } from '../../platform/crypto.ts'
import { get, run, tx } from '../../platform/db.ts'
import { AppError, badRequest, tooMany } from '../../platform/errors.ts'

export type Purpose = 'verify_email' | 'verify_phone' | 'reset_password'

export const CODE = { length: 6, ttlMs: 10 * 60_000, maxAttempts: 5, resendMs: 60_000, maxPerHour: 5 } as const

interface CodeRow {
  id: string
  code_hash: string
  salt: string
  expires_at: number
  attempts: number
  created_at: number
}

const bad = () => badRequest('invalid_code', 'That code isn’t right, or it has expired. Request a new one.')

/**
 * Sends a one-time code. Rules: 60 seconds between sends, 5 per hour per target,
 * a new code cancels the previous one, and only a hash of the code is stored.
 */
export async function requestCode(deps: Deps, p: { purpose: Purpose; target: string; userId?: string }): Promise<{ resendAfter: number; devCode?: string }> {
  const now = deps.clock.now()
  const last = get<{ created_at: number }>(deps.db, 'SELECT created_at FROM verification_codes WHERE purpose = ? AND target = ? ORDER BY created_at DESC LIMIT 1', p.purpose, p.target)
  if (last && now - last.created_at < CODE.resendMs) throw tooMany(Math.ceil((last.created_at + CODE.resendMs - now) / 1000), 'Please wait a moment before requesting another code.')

  const hour = get<{ n: number }>(deps.db, 'SELECT COUNT(*) AS n FROM verification_codes WHERE purpose = ? AND target = ? AND created_at > ?', p.purpose, p.target, now - 3_600_000)
  if ((hour?.n ?? 0) >= CODE.maxPerHour) throw tooMany(3600, 'Too many codes requested. Try again in an hour.')

  const code = randomDigits(CODE.length)
  const salt = randomToken(8)

  tx(deps.db, () => {
    run(deps.db, 'UPDATE verification_codes SET consumed_at = ? WHERE purpose = ? AND target = ? AND consumed_at IS NULL', now, p.purpose, p.target)
    run(deps.db, 'INSERT INTO verification_codes (id,purpose,target,user_id,code_hash,salt,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)',
      newId(), p.purpose, p.target, p.userId, sha256(`${salt}:${code}`), salt, now + CODE.ttlMs, now)
  })

  await deps.notifier.send({
    channel: p.purpose === 'verify_phone' ? 'sms' : 'email',
    to: p.target,
    template: p.purpose === 'reset_password' ? 'reset_code' : 'verify_code',
    code,
  })

  return { resendAfter: now + CODE.resendMs, devCode: deps.config.exposeDevCodes ? code : undefined }
}

/**
 * Checks a code. Five wrong guesses burn it (brute force gets 5 tries per code,
 * not unlimited). A correct code works once. Throws 400 invalid_code otherwise.
 */
export function confirmCode(deps: Deps, p: { purpose: Purpose; target: string; code: string }): void {
  const now = deps.clock.now()

  // The failed-attempt counter MUST be saved even though we then throw,
  // so decide inside the transaction and throw only after it commits.
  const outcome = tx(deps.db, (): 'ok' | 'bad' | { left: number } => {
    const row = get<CodeRow>(deps.db,
      'SELECT id,code_hash,salt,expires_at,attempts,created_at FROM verification_codes WHERE purpose = ? AND target = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1',
      p.purpose, p.target)
    if (!row || row.expires_at <= now || row.attempts >= CODE.maxAttempts) return 'bad'

    if (/^\d+$/.test(p.code) && p.code.length === CODE.length && safeEqual(sha256(`${row.salt}:${p.code}`), row.code_hash)) {
      run(deps.db, 'UPDATE verification_codes SET consumed_at = ? WHERE id = ?', now, row.id)
      return 'ok'
    }

    const attempts = row.attempts + 1
    run(deps.db, 'UPDATE verification_codes SET attempts = ?, consumed_at = ? WHERE id = ?', attempts, attempts >= CODE.maxAttempts ? now : null, row.id)
    return attempts >= CODE.maxAttempts ? 'bad' : { left: CODE.maxAttempts - attempts }
  })

  if (outcome === 'ok') return
  if (outcome === 'bad') throw bad()
  throw new AppError(400, 'invalid_code', `That code isn’t right. ${outcome.left} attempt(s) left.`, { attemptsLeft: outcome.left })
}

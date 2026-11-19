import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { run } from '../../platform/db.ts'
import { conflict, tooMany, unprocessable } from '../../platform/errors.ts'
import { requireAuth, type Router } from '../../platform/http.ts'
import { oneOf, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { CODE, confirmCode, requestCode, type Purpose } from './service.ts'

const PURPOSE = { email: 'verify_email', phone: 'verify_phone' } as const

export function verificationRoutes(router: Router, deps: Deps) {
  /**
   * The server decides WHAT is verified: always the account's current email or
   * phone. The client only chooses the channel, so nobody can "verify" a
   * number that isn't theirs.
   */
  router.post('/api/verification/request', requireAuth, async (ctx) => {
    const { channel } = parse({ channel: oneOf(['email', 'phone']) }, ctx.body)
    const user = ctx.user!

    const wait = deps.limiter.check(`verify:${ctx.ip}`, 30, 10 * 60_000)
    if (wait) throw tooMany(wait)

    if (channel === 'email' ? user.emailVerified : user.phoneVerified) throw conflict('already_verified', 'This is already verified.')
    const target = channel === 'email' ? user.email : user.phone
    if (!target) throw unprocessable('phone', 'Add a phone number to your profile first.')

    const sent = await requestCode(deps, { purpose: PURPOSE[channel] as Purpose, target, userId: user.id })
    return { channel, to: target, resendAfter: sent.resendAfter, expiresInSec: CODE.ttlMs / 1000, ...(sent.devCode ? { devCode: sent.devCode } : {}) }
  })

  router.post('/api/verification/confirm', requireAuth, (ctx) => {
    const { channel, code } = parse({ channel: oneOf(['email', 'phone']), code: str({ min: 1, max: 12 }) }, ctx.body)
    const user = ctx.user!

    const wait = deps.limiter.check(`confirm:${user.id}`, 30, 10 * 60_000)
    if (wait) throw tooMany(wait)

    const target = channel === 'email' ? user.email : user.phone
    if (!target) throw unprocessable('phone', 'Add a phone number to your profile first.')

    confirmCode(deps, { purpose: PURPOSE[channel] as Purpose, target, code })

    const col = channel === 'email' ? 'email_verified_at' : 'phone_verified_at'
    run(deps.db, `UPDATE users SET ${col} = ?, updated_at = ? WHERE id = ?`, iso(deps.clock.now()), iso(deps.clock.now()), user.id)
    audit(deps, ctx, { action: `user.${channel}_verified`, entityType: 'user', entityId: user.id })
    return { verified: channel }
  })
}

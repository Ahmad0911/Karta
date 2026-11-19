import type { Deps } from '../../deps.ts'
import { newId, randomToken, sha256, signJwt } from '../../platform/crypto.ts'
import { iso } from '../../platform/clock.ts'
import { get, run, tx } from '../../platform/db.ts'
import { unauthorized } from '../../platform/errors.ts'
import type { Ctx } from '../../platform/http.ts'
import { audit } from '../audit/audit.ts'
import { findUserById, isUsable, type UserRow } from './users.ts'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

const accessFor = (deps: Deps, user: Pick<UserRow, 'id' | 'role'>, familyId: string) => {
  const iat = Math.floor(deps.clock.now() / 1000)
  return signJwt({ sub: user.id, role: user.role, fid: familyId, iat, exp: iat + deps.config.accessTtlSec }, deps.config.jwtSecret)
}

/** New sign-in: a new session family with one refresh token. */
export function startSession(deps: Deps, user: UserRow, meta: { ip: string; userAgent?: string }): Tokens {
  const familyId = newId()
  const refreshToken = randomToken(32)
  const now = deps.clock.now()
  run(deps.db, 'INSERT INTO session_families (id,user_id,created_at) VALUES (?,?,?)', familyId, user.id, iso(now))
  run(deps.db, 'INSERT INTO sessions (id,family_id,user_id,token_hash,created_at,expires_at,user_agent,ip) VALUES (?,?,?,?,?,?,?,?)',
    newId(), familyId, user.id, sha256(refreshToken), iso(now), now + deps.config.refreshTtlSec * 1000, meta.userAgent?.slice(0, 200), meta.ip)
  return { accessToken: accessFor(deps, user, familyId), refreshToken }
}

/**
 * Exchanges a refresh token for a new pair. Every refresh token works ONCE.
 * Presenting one that was already used means it was copied: the whole sign-in
 * (family) is revoked, logging out both the thief and the real user.
 */
export function rotateSession(deps: Deps, ctx: Pick<Ctx, 'ip' | 'requestId' | 'user'>, refreshToken: string, userAgent?: string): { tokens: Tokens; user: UserRow } {
  const row = get<{ id: string; family_id: string; user_id: string; expires_at: number; rotated_at: string | null }>(
    deps.db, 'SELECT id,family_id,user_id,expires_at,rotated_at FROM sessions WHERE token_hash = ?', sha256(refreshToken))
  if (!row) throw unauthorized('Your session has ended. Please sign in again.', 'session_invalid')

  const family = get<{ revoked_at: string | null }>(deps.db, 'SELECT revoked_at FROM session_families WHERE id = ?', row.family_id)
  if (!family || family.revoked_at) throw unauthorized('Your session has ended. Please sign in again.', 'session_invalid')

  if (row.rotated_at) {
    tx(deps.db, () => {
      run(deps.db, 'UPDATE session_families SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL', iso(deps.clock.now()), 'refresh_reuse_detected', row.family_id)
      audit(deps, ctx, { action: 'auth.refresh_reuse_detected', entityType: 'user', entityId: row.user_id, actor: { id: row.user_id, role: 'unknown' } })
    })
    throw unauthorized('Your session has ended. Please sign in again.', 'session_invalid')
  }

  if (row.expires_at <= deps.clock.now()) throw unauthorized('Your session has expired. Please sign in again.', 'session_expired')

  const user = findUserById(deps.db, row.user_id)
  if (!user || !isUsable(user)) throw unauthorized('Your session has ended. Please sign in again.', 'session_invalid')

  const next = randomToken(32)
  tx(deps.db, () => {
    const now = deps.clock.now()
    run(deps.db, 'UPDATE sessions SET rotated_at = ? WHERE id = ?', iso(now), row.id)
    run(deps.db, 'INSERT INTO sessions (id,family_id,user_id,token_hash,created_at,expires_at,user_agent,ip) VALUES (?,?,?,?,?,?,?,?)',
      newId(), row.family_id, user.id, sha256(next), iso(now), now + deps.config.refreshTtlSec * 1000, userAgent?.slice(0, 200), ctx.ip)
  })

  return { tokens: { accessToken: accessFor(deps, user, row.family_id), refreshToken: next }, user }
}

export const revokeFamily = (deps: Deps, familyId: string, reason: string) =>
  run(deps.db, 'UPDATE session_families SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL', iso(deps.clock.now()), reason, familyId)

/** Signs the user out everywhere (password change/reset, deactivation, deletion). */
export const revokeAllSessions = (deps: Deps, userId: string, reason: string) =>
  run(deps.db, 'UPDATE session_families SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL', iso(deps.clock.now()), reason, userId)

export const isFamilyActive = (deps: Deps, familyId: string) =>
  get<{ revoked_at: string | null }>(deps.db, 'SELECT revoked_at FROM session_families WHERE id = ?', familyId)?.revoked_at === null

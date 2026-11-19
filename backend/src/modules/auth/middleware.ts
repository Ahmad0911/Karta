import { verifyJwt } from '../../platform/crypto.ts'
import type { AuthUser, Ctx } from '../../platform/http.ts'
import { isFamilyActive } from './sessions.ts'
import { findUserById, isUsable, toAuthUser } from './users.ts'

export const ACCESS_COOKIE = 'karta_at'
export const REFRESH_COOKIE = 'karta_rt'
export const REFRESH_PATH = '/api/auth'

/**
 * Identifies the caller on every request. Beyond checking the token's signature
 * and expiry it re-reads the account and the session, so deactivating a user or
 * signing out takes effect immediately instead of when the token expires.
 */
export async function authenticate(ctx: Ctx): Promise<AuthUser | null> {
  const header = String(ctx.req.headers.authorization ?? '')
  const token = ctx.cookies[ACCESS_COOKIE] ?? (header.startsWith('Bearer ') ? header.slice(7) : undefined)
  if (!token) return null

  const { deps } = ctx
  const claims = verifyJwt(token, deps.config.jwtSecret, Math.floor(deps.clock.now() / 1000))
  if (!claims) return null

  const user = findUserById(deps.db, claims.sub)
  if (!user || !isUsable(user) || !isFamilyActive(deps, claims.fid)) return null
  return toAuthUser(user, claims.fid)
}

import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { dummyHash, hashPassword, newId, sha256, verifyPassword } from '../../platform/crypto.ts'
import { get, run, tx } from '../../platform/db.ts'
import { AppError, conflict, forbidden, invalid, tooMany, unauthorized } from '../../platform/errors.ts'
import { requireAuth, type Ctx, type Router } from '../../platform/http.ts'
import { email, normalisePhone, oneOf, optional, parse, phoneNg, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { confirmCode, requestCode } from '../verification/service.ts'
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_PATH } from './middleware.ts'
import { passwordProblem } from './passwordPolicy.ts'
import { revokeAllSessions, revokeFamily, rotateSession, startSession, type Tokens } from './sessions.ts'
import { findUserByEmail, findUserById, insertUser, isUsable, publicUser, type UserRow } from './users.ts'

const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60_000

const password = () => str({ min: 1, max: 128, label: 'Password' })

export function authRoutes(router: Router, deps: Deps) {
  const { db, clock, config, limiter } = deps

  const setCookies = (ctx: Ctx, t: Tokens) => {
    ctx.setCookie(ACCESS_COOKIE, t.accessToken, { maxAgeSec: config.accessTtlSec })
    ctx.setCookie(REFRESH_COOKIE, t.refreshToken, { maxAgeSec: config.refreshTtlSec, path: REFRESH_PATH })
  }
  const clearCookies = (ctx: Ctx) => {
    ctx.clearCookie(ACCESS_COOKIE)
    ctx.clearCookie(REFRESH_COOKIE, REFRESH_PATH)
  }
  const limit = (key: string, n: number, windowMs: number) => {
    const wait = limiter.check(key, n, windowMs)
    if (wait) throw tooMany(wait)
  }
  const ua = (ctx: Ctx) => String(ctx.req.headers['user-agent'] ?? '')
  const needsPolicy = (pw: string, mail: string, field = 'password') => {
    const problem = passwordProblem(pw, mail)
    if (problem) throw invalid({ [field]: problem }, problem)
  }

  /* ------------------------------ Register ------------------------------ */
  router.post('/api/auth/register', async (ctx) => {
    limit(`register:${ctx.ip}`, 10, 3_600_000)

    // "role" accepts ONLY customer or vendor. Staff and drivers are never self-service.
    const b = parse({
      name: str({ min: 2, max: 80, label: 'Name' }), email: email(), phone: phoneNg(), password: password(),
      role: optional(oneOf(['customer', 'vendor'])), businessName: optional(str({ min: 2, max: 120 })),
    }, ctx.body)
    const role = b.role ?? 'customer'
    if (role === 'vendor' && !b.businessName) throw invalid({ businessName: 'Enter your business or workshop name.' })
    needsPolicy(b.password, b.email)

    const passwordHash = await hashPassword(b.password, config.scryptN)
    const id = newId()

    try {
      tx(db, () => {
        insertUser(db, { id, email: b.email, name: b.name, phone: b.phone, role, passwordHash, businessName: role === 'vendor' ? b.businessName : undefined, now: iso(clock.now()) })
        audit(deps, ctx, { action: 'user.registered', entityType: 'user', entityId: id, actor: { id, role }, meta: { role } })
      })
    } catch (e) {
      if (e instanceof Error && /UNIQUE constraint failed: users\.email/.test(e.message)) throw conflict('email_taken', 'An account with this email already exists. Sign in instead.')
      throw e
    }

    const user = findUserById(db, id) as UserRow
    setCookies(ctx, startSession(deps, user, { ip: ctx.ip, userAgent: ua(ctx) }))
    ctx.json(201, { user: publicUser(user) })
  })

  /* ------------------------------- Login -------------------------------- */
  router.post('/api/auth/login', async (ctx) => {
    limit(`login:${ctx.ip}`, 30, 10 * 60_000)
    const b = parse({ email: email(), password: password() }, ctx.body)
    const now = clock.now()

    // Lockouts are tracked per email, including emails that don't exist.
    const att = get<{ failures: number; locked_until: number | null }>(db, 'SELECT failures, locked_until FROM login_attempts WHERE email = ?', b.email)
    if (att?.locked_until && att.locked_until > now) throw new AppError(429, 'account_locked', `Too many failed attempts. Try again in ${Math.ceil((att.locked_until - now) / 60_000)} minute(s).`, { retryAfterSec: Math.ceil((att.locked_until - now) / 1000) })

    const user = findUserByEmail(db, b.email)
    // Always do the hashing work, so an unknown email takes as long as a wrong password.
    const valid = await verifyPassword(b.password, user?.password_hash ?? (await dummyHash(config.scryptN)))

    if (!user || !user.password_hash || !valid) {
      const prior = att?.locked_until && att.locked_until <= now ? 0 : att?.failures ?? 0
      const failures = prior + 1
      const lock = failures >= MAX_FAILURES
      run(db, `INSERT INTO login_attempts (email,failures,locked_until,updated_at) VALUES (?,?,?,?)
               ON CONFLICT(email) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
        b.email, lock ? 0 : failures, lock ? now + LOCKOUT_MS : null, now)
      if (lock) audit(deps, ctx, { action: 'auth.locked_out', entityType: 'user', entityId: user?.id, actor: { id: user?.id ?? 'anonymous', role: 'unknown' } })
      throw unauthorized('Incorrect email or password.', 'invalid_credentials')
    }

    // Only someone who knows the password learns the account is deactivated.
    if (!isUsable(user)) throw forbidden('This account has been deactivated. Please contact Karta support.', 'account_disabled')

    run(db, 'DELETE FROM login_attempts WHERE email = ?', b.email)
    audit(deps, ctx, { action: 'auth.login', entityType: 'user', entityId: user.id, actor: { id: user.id, role: user.role } })
    setCookies(ctx, startSession(deps, user, { ip: ctx.ip, userAgent: ua(ctx) }))
    return { user: publicUser(user) }
  })

  /* ------------------------------- Refresh ------------------------------ */
  router.post('/api/auth/refresh', (ctx) => {
    limit(`refresh:${ctx.ip}`, 120, 10 * 60_000)
    const token = ctx.cookies[REFRESH_COOKIE]
    if (!token) throw unauthorized('Please sign in.', 'session_invalid')
    try {
      const { tokens, user } = rotateSession(deps, ctx, token, ua(ctx))
      setCookies(ctx, tokens)
      return { user: publicUser(user) }
    } catch (e) {
      clearCookies(ctx)
      // The 401 must still be sent along with the cookie-clearing headers.
      if (e instanceof AppError) return ctx.json(e.status, { error: { code: e.code, message: e.message, requestId: ctx.requestId } })
      throw e
    }
  })

  /* ------------------------------- Logout ------------------------------- */
  router.post('/api/auth/logout', (ctx) => {
    const token = ctx.cookies[REFRESH_COOKIE]
    const fam = ctx.user?.familyId ?? (token ? get<{ family_id: string }>(db, 'SELECT family_id FROM sessions WHERE token_hash = ?', sha256(token))?.family_id : undefined)
    if (fam) {
      revokeFamily(deps, fam, 'logout')
      if (ctx.user) audit(deps, ctx, { action: 'auth.logout', entityType: 'user', entityId: ctx.user.id })
    }
    clearCookies(ctx)
    ctx.json(204)
  })

  /* --------------------------------- Me --------------------------------- */
  router.get('/api/auth/me', requireAuth, (ctx) => ({ user: publicUser(findUserById(db, ctx.user!.id) as UserRow) }))

  router.patch('/api/me', requireAuth, (ctx) => {
    const b = parse({ name: str({ min: 2, max: 80, label: 'Name' }), phone: phoneNg() }, ctx.body)
    const me = findUserById(db, ctx.user!.id) as UserRow
    const phoneChanged = normalisePhone(b.phone) !== (me.phone_norm ?? '')

    tx(db, () => {
      run(db, `UPDATE users SET name = ?, phone = ?, phone_norm = ?, phone_verified_at = ${phoneChanged ? 'NULL' : 'phone_verified_at'}, updated_at = ? WHERE id = ?`,
        b.name.replace(/\s+/g, ' '), b.phone, normalisePhone(b.phone), iso(clock.now()), me.id)
      audit(deps, ctx, { action: 'user.profile_updated', entityType: 'user', entityId: me.id, meta: { phoneChanged } })
    })
    return { user: publicUser(findUserById(db, me.id) as UserRow) }
  })

  /* ---------------------------- Change password -------------------------- */
  router.post('/api/auth/password/change', requireAuth, async (ctx) => {
    limit(`pwchange:${ctx.user!.id}`, 10, 10 * 60_000)
    const b = parse({ currentPassword: password(), newPassword: password() }, ctx.body)
    const me = findUserById(db, ctx.user!.id) as UserRow

    if (!(await verifyPassword(b.currentPassword, me.password_hash ?? ''))) throw invalid({ currentPassword: 'Your current password is incorrect.' })
    if (b.newPassword === b.currentPassword) throw invalid({ newPassword: 'Choose a password you haven’t used just now.' })
    needsPolicy(b.newPassword, me.email, 'newPassword')

    const hash = await hashPassword(b.newPassword, config.scryptN)
    tx(db, () => {
      run(db, 'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?', hash, iso(clock.now()), me.id)
      revokeAllSessions(deps, me.id, 'password_changed') // sign out every other device
      audit(deps, ctx, { action: 'auth.password_changed', entityType: 'user', entityId: me.id })
    })
    // Keep THIS device signed in with a fresh session.
    setCookies(ctx, startSession(deps, findUserById(db, me.id) as UserRow, { ip: ctx.ip, userAgent: ua(ctx) }))
    return { user: publicUser(findUserById(db, me.id) as UserRow) }
  })

  /* ----------------------------- Forgot / reset -------------------------- */
  // Same answer whether or not the email has an account, so this can't be used to find out who does.
  router.post('/api/auth/password/forgot', async (ctx) => {
    limit(`forgot:${ctx.ip}`, 10, 3_600_000)
    const b = parse({ email: email() }, ctx.body)
    const user = findUserByEmail(db, b.email)

    let devCode: string | undefined
    if (user && isUsable(user)) {
      try {
        devCode = (await requestCode(deps, { purpose: 'reset_password', target: user.email, userId: user.id })).devCode
      } catch (e) {
        if (!(e instanceof AppError && e.status === 429)) throw e // cooldown/cap: stay silent
      }
    }
    return ctx.json(202, { ok: true, ...(devCode ? { devCode } : {}) })
  })

  router.post('/api/auth/password/reset', async (ctx) => {
    limit(`reset:${ctx.ip}`, 20, 3_600_000)
    const b = parse({ email: email(), code: str({ min: 1, max: 12 }), newPassword: password() }, ctx.body)
    needsPolicy(b.newPassword, b.email, 'newPassword') // check BEFORE spending the code

    confirmCode(deps, { purpose: 'reset_password', target: b.email, code: b.code })
    const user = findUserByEmail(db, b.email)
    if (!user || !isUsable(user)) throw new AppError(400, 'invalid_code', 'That code isn’t right, or it has expired. Request a new one.')

    const hash = await hashPassword(b.newPassword, config.scryptN)
    tx(db, () => {
      run(db, 'UPDATE users SET password_hash = ?, must_change_password = 0, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?', hash, iso(clock.now()), iso(clock.now()), user.id)
      revokeAllSessions(deps, user.id, 'password_reset')
      run(db, 'DELETE FROM login_attempts WHERE email = ?', user.email)
      audit(deps, ctx, { action: 'auth.password_reset', entityType: 'user', entityId: user.id, actor: { id: user.id, role: user.role } })
    })
    clearCookies(ctx)
    return { ok: true }
  })

  /* ------------------------------ Delete account ------------------------- */
  router.delete('/api/me', requireAuth, async (ctx) => {
    limit(`delete:${ctx.user!.id}`, 5, 10 * 60_000)
    const b = parse({ password: password() }, ctx.body)
    const me = findUserById(db, ctx.user!.id) as UserRow

    if (me.role !== 'customer') throw forbidden('Vendor and staff accounts are closed by Karta support so open orders and payouts are settled first.', 'support_required')
    if (!(await verifyPassword(b.password, me.password_hash ?? ''))) throw invalid({ password: 'That password is incorrect.' })

    // TODO(orders phase): refuse while the customer has orders in progress.
    tx(db, () => {
      run(db, `UPDATE users SET email = ?, name = 'Deleted user', phone = NULL, phone_norm = NULL, business_name = NULL, password_hash = NULL,
               email_verified_at = NULL, phone_verified_at = NULL, deleted_at = ?, updated_at = ? WHERE id = ?`,
        `deleted+${me.id}@karta.invalid`, iso(clock.now()), iso(clock.now()), me.id)
      revokeAllSessions(deps, me.id, 'account_deleted')
      audit(deps, ctx, { action: 'user.deleted', entityType: 'user', entityId: me.id })
    })
    clearCookies(ctx)
    ctx.json(204)
  })
}

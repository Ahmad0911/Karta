import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { hashPassword, newId, tempPassword } from '../../platform/crypto.ts'
import { all, run, tx } from '../../platform/db.ts'
import { conflict, forbidden, notFound } from '../../platform/errors.ts'
import { staffOnly, type Handler, type Router } from '../../platform/http.ts'
import { email, int, optional, parse, phoneNg, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { revokeAllSessions } from '../auth/sessions.ts'
import { findUserById, insertUser, publicUser, type UserRow } from '../auth/users.ts'

export function adminRoutes(router: Router, deps: Deps) {
  const { db, clock, config } = deps

  /* ---------------------- Driver (logistics) accounts ---------------------- */
  // Drivers are created by staff only. They get a one-time temporary password
  // and must choose their own before the API lets them do anything else.
  router.post('/api/admin/drivers', staffOnly, async (ctx) => {
    const b = parse({ name: str({ min: 2, max: 80, label: 'Name' }), email: email(), phone: phoneNg() }, ctx.body)
    const temp = tempPassword()
    const hash = await hashPassword(temp, config.scryptN)
    const id = newId()

    try {
      tx(db, () => {
        insertUser(db, { id, email: b.email, name: b.name, phone: b.phone, role: 'logistics', passwordHash: hash, mustChangePassword: true, createdBy: ctx.user!.id, now: iso(clock.now()) })
        audit(deps, ctx, { action: 'driver.created', entityType: 'user', entityId: id })
      })
    } catch (e) {
      if (e instanceof Error && /UNIQUE constraint failed: users\.email/.test(e.message)) throw conflict('email_taken', 'An account with this email already exists.')
      throw e
    }
    // The temporary password is returned ONCE and never stored in plain text.
    ctx.json(201, { driver: publicUser(findUserById(db, id) as UserRow), tempPassword: temp })
  })

  router.get('/api/admin/drivers', staffOnly, () => ({
    drivers: all<UserRow>(db, "SELECT * FROM users WHERE role = 'logistics' AND deleted_at IS NULL ORDER BY name").map((r) => ({ ...publicUser(r), disabled: r.disabled_at !== null })),
  }))

  const toggle = (disable: boolean): Handler => (ctx) => {
    const target = findUserById(db, ctx.params.id as string)
    if (!target || target.role !== 'logistics') throw notFound('Driver not found.')
    if (target.id === ctx.user!.id) throw forbidden('You can’t deactivate your own account.')

    tx(db, () => {
      run(db, 'UPDATE users SET disabled_at = ?, updated_at = ? WHERE id = ?', disable ? iso(clock.now()) : null, iso(clock.now()), target.id)
      if (disable) revokeAllSessions(deps, target.id, 'deactivated') // signed out immediately
      audit(deps, ctx, { action: disable ? 'driver.deactivated' : 'driver.reactivated', entityType: 'user', entityId: target.id })
    })
    return { ok: true }
  }
  router.post('/api/admin/drivers/:id/deactivate', staffOnly, toggle(true))
  router.post('/api/admin/drivers/:id/reactivate', staffOnly, toggle(false))

  /* ------------------------------ Audit log -------------------------------- */
  router.get('/api/admin/audit', staffOnly, (ctx) => {
    const q = parse({ limit: optional(int({ min: 1, max: 200 })) }, { limit: ctx.query.get('limit') ? Number(ctx.query.get('limit')) : undefined })
    const type = ctx.query.get('entityType')
    const id = ctx.query.get('entityId')
    const rows = all<Record<string, unknown>>(db,
      `SELECT id, at, actor_id, actor_role, action, entity_type, entity_id, meta, ip, request_id FROM audit_log
       WHERE (? IS NULL OR entity_type = ?) AND (? IS NULL OR entity_id = ?) ORDER BY id DESC LIMIT ?`,
      type, type, id, id, q.limit ?? 50)
    return { events: rows.map((r) => ({ ...r, meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : null })) }
  })
}

import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { run } from '../../platform/db.ts'
import type { Ctx } from '../../platform/http.ts'

export interface AuditEvent {
  action: string
  entityType?: string
  entityId?: string
  meta?: Record<string, unknown>
  /** Use when there is no signed-in user on the request (login, reset). */
  actor?: { id: string; role: string }
}

/**
 * Writes to the append-only audit log. Never put passwords, codes or tokens in `meta`.
 * Call it INSIDE the same transaction as the change it records, so the two can't diverge.
 */
export function audit(deps: Deps, ctx: Pick<Ctx, 'user' | 'ip' | 'requestId'> | null, e: AuditEvent): void {
  const actor = e.actor ?? (ctx?.user ? { id: ctx.user.id, role: ctx.user.role } : undefined)
  run(
    deps.db,
    'INSERT INTO audit_log (at, actor_id, actor_role, action, entity_type, entity_id, meta, ip, request_id) VALUES (?,?,?,?,?,?,?,?,?)',
    iso(deps.clock.now()), actor?.id, actor?.role, e.action, e.entityType, e.entityId, e.meta ? JSON.stringify(e.meta) : undefined, ctx?.ip, ctx?.requestId,
  )
}

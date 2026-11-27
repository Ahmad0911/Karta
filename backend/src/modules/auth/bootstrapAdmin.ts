import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { hashPassword, newId } from '../../platform/crypto.ts'
import { get } from '../../platform/db.ts'
import { passwordProblem } from './passwordPolicy.ts'
import { insertUser } from './users.ts'

/**
 * For hosts that give you no terminal: set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD
 * once, deploy, sign in, then DELETE those three settings.
 *
 * It only ever creates the very FIRST admin. If any admin already exists it does nothing, so leaving the
 * settings in place can never reset a password or add a second admin.
 */
export async function bootstrapAdmin(deps: Deps, env: Record<string, string | undefined> = process.env): Promise<'created' | 'skipped' | 'invalid'> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const name = env.BOOTSTRAP_ADMIN_NAME?.trim()
  const password = env.BOOTSTRAP_ADMIN_PASSWORD
  if (!email && !password) return 'skipped'
  // Once any admin exists this does nothing at all, whatever the settings say.
  if (get(deps.db, "SELECT 1 AS x FROM users WHERE role IN ('admin','super_admin') LIMIT 1")) return 'skipped'

  if (!email || !name || !password) { deps.log.log('error', 'bootstrap admin: set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD together'); return 'invalid' }
  const problem = passwordProblem(password, email)
  if (problem) { deps.log.log('error', `bootstrap admin: ${problem}`); return 'invalid' }

  if (get(deps.db, 'SELECT 1 AS x FROM users WHERE email = ?', email)) { deps.log.log('error', 'bootstrap admin: that email already belongs to a non-admin account'); return 'invalid' }

  const now = iso(deps.clock.now())
  insertUser(deps.db, { id: newId(), email, name, role: 'admin', passwordHash: await hashPassword(password, deps.config.scryptN), emailVerifiedAt: now, now })
  deps.log.log('warn', 'First admin created. Now DELETE the BOOTSTRAP_ADMIN_* settings from your host.')
  return 'created'
}

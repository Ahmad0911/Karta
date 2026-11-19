import type { Deps } from './deps.ts'
import { adminRoutes } from './modules/admin/routes.ts'
import { authenticate } from './modules/auth/middleware.ts'
import { authRoutes } from './modules/auth/routes.ts'
import { vendorRoutes } from './modules/vendors/routes.ts'
import { verificationRoutes } from './modules/verification/routes.ts'
import { all } from './platform/db.ts'
import { createHandler, Router } from './platform/http.ts'

/** Wires every module onto one router. Add a module = add one line here. */
export function createApp(deps: Deps) {
  const router = new Router()

  router.get('/api/health', () => ({ status: 'ok' }))
  router.get('/api/ready', () => {
    all(deps.db, 'SELECT 1')
    return { status: 'ready' }
  })

  authRoutes(router, deps)
  verificationRoutes(router, deps)
  adminRoutes(router, deps)
  vendorRoutes(router, deps)

  return createHandler({ deps, router, authenticate })
}

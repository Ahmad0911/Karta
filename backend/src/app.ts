import type { Deps } from './deps.ts'
import { adminRoutes } from './modules/admin/routes.ts'
import { authenticate } from './modules/auth/middleware.ts'
import { authRoutes } from './modules/auth/routes.ts'
import { conversationRoutes } from './modules/conversations/routes.ts'
import { fulfilmentRoutes } from './modules/marketplace/fulfilment.ts'
import { listingRoutes } from './modules/marketplace/listings.ts'
import { orderRoutes } from './modules/orders/routes.ts'
import { paymentRoutes } from './modules/payments/routes.ts'
import { requestRoutes } from './modules/requests/routes.ts'
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
  orderRoutes(router, deps)
  listingRoutes(router, deps)
  fulfilmentRoutes(router, deps)
  paymentRoutes(router, deps)
  requestRoutes(router, deps)
  conversationRoutes(router, deps)

  return createHandler({ deps, router, authenticate })
}

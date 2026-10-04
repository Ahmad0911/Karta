
import type { ReactNode } from 'react'
import {
  Navigate,
  useLocation,
} from 'react-router-dom'

import { useAuthStore } from '@/store/auth.store'
import type { Role } from '@/types'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface RequireAuthProps {
  /**
   * Roles permitted to access the protected content.
   *
   * When omitted, any authenticated user may continue.
   */
  roles?: readonly Role[]

  children: ReactNode
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds the exact route the visitor attempted to access.
 *
 * This allows the authentication flow to preserve the destination so the
 * login page can redirect the user back after successful authentication.
 */
function getReturnPath(location: ReturnType<typeof useLocation>) {
  return [
    location.pathname,
    location.search,
    location.hash,
  ].join('')
}

/* -------------------------------------------------------------------------- */
/* Authentication & Authorization Guard                                       */
/* -------------------------------------------------------------------------- */

/**
 * Client-side authentication and role guard.
 *
 * BRD §20.3
 *
 * IMPORTANT:
 * This component exists primarily for navigation UX.
 * Authentication, authorization, RBAC, resource ownership, and all
 * security-sensitive decisions MUST still be enforced by the API/server.
 *
 * Behaviour:
 *
 * 1. No authenticated user
 *    → redirect to /login
 *
 * 2. Authenticated user without the required role
 *    → redirect to /
 *
 * 3. super_admin
 *    → bypass role restrictions
 *
 * 4. Authorized user
 *    → render protected content
 */
export default function RequireAuth({
  roles,
  children,
}: RequireAuthProps) {
  const user = useAuthStore((state) => state.user)
  const disabled = useAuthStore((state) =>
    state.user ? state.accounts[state.user.email.trim().toLowerCase()]?.disabled : false,
  )
  const location = useLocation()

  /* ------------------------------------------------------------------------ */
  /* Authentication                                                           */
  /* ------------------------------------------------------------------------ */

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: getReturnPath(location),
        }}
      />
    )
  }

  /* ------------------------------------------------------------------------ */
  /* Deactivated accounts and temporary passwords                             */
  /* ------------------------------------------------------------------------ */

  // A deactivated account loses access even if its session is still open.
  if (disabled) {
    return <Navigate to="/login" replace />
  }

  // Accounts created with a temporary password must choose their own first.
  if (user.mustChangePassword && location.pathname !== '/account/security') {
    return <Navigate to="/account/security" replace />
  }

  /* ------------------------------------------------------------------------ */
  /* Authorization / RBAC                                                    */
  /* ------------------------------------------------------------------------ */

  const isSuperAdmin = user.role === 'super_admin'

  const hasRequiredRole =
    !roles ||
    isSuperAdmin ||
    roles.includes(user.role)

  if (!hasRequiredRole) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  /* ------------------------------------------------------------------------ */
  /* Authorized content                                                       */
  /* ------------------------------------------------------------------------ */

  return <>{children}</>
}
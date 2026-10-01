import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role, User } from '@/types'

/* -------------------------------------------------------------------------- */
/* Karta Authentication State                                                 */
/* -------------------------------------------------------------------------- */
/**
 * MOCK AUTH
 *
 * Replace with the NestJS authentication API when the backend is connected
 * (JWT, OTP, email verification, session refresh, password recovery).
 * BRD / FR reference: FR-AUTH-001..007
 *
 * IMPORTANT: this mock does not check passwords, and roles live in the
 * browser. Role and vendor approval MUST be decided by the server. Nothing
 * here is a security boundary.
 */

export interface RegisterData {
  name: string
  email: string
  phone: string
  /** Only 'vendor' is honoured. Anything else becomes 'customer'. */
  role?: Role
  businessName?: string
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string }

interface AuthState {
  user: User | null

  /** Registered accounts by email, so signing in again restores the profile. */
  accounts: Record<string, User>

  isAuthenticated: boolean

  login: (email: string, role?: Role) => void
  register: (data: RegisterData) => RegisterResult
  logout: () => void
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const createMockUser = (data: Omit<User, 'id'>): User => ({
  id: crypto.randomUUID(),
  ...data,
})

const getNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0]?.trim()

  if (!localPart) return 'Karta Customer'

  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: {},
      isAuthenticated: false,

      login: (email, role) => {
        const key = email.trim().toLowerCase()
        const existing = get().accounts[key]

        // A registered account keeps its own role. An explicit role (the
        // dev shortcuts) creates a fresh account with that role instead.
        const user =
          existing && (!role || existing.role === role)
            ? existing
            : createMockUser({
                name: getNameFromEmail(key),
                email: key,
                role: role ?? 'customer',
              })

        set({ user, isAuthenticated: true })
      },

      register: (data) => {
        const key = data.email.trim().toLowerCase()

        if (get().accounts[key]) {
          return {
            ok: false,
            error: 'An account with this email already exists. Sign in instead.',
          }
        }

        const isVendor = data.role === 'vendor'
        const businessName = data.businessName?.trim()

        const user = createMockUser({
          name: data.name.trim(),
          email: key,
          phone: data.phone.trim(),
          role: isVendor ? 'vendor' : 'customer',
          ...(isVendor && businessName ? { businessName } : {}),
        })

        set((state) => ({
          user,
          isAuthenticated: true,
          accounts: { ...state.accounts, [key]: user },
        }))

        return { ok: true }
      },

      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'karta-auth',
    },
  ),
)
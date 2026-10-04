import { uuid } from '@/lib/id'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { hashPassword, newSalt, passwordProblem, safeEqual } from '@/lib/password'
import { samePhone } from '@/lib/phone'
import { isNigerianPhone } from '@/modules/vendors/lib/onboarding'
import { safeStorage } from '@/lib/safeStorage'
import type { Role, User } from '@/types'

/* -------------------------------------------------------------------------- */
/* Karta Authentication State (MOCK)                                          */
/* -------------------------------------------------------------------------- */
/**
 * MOCK AUTH. Replace with the NestJS authentication API (JWT in httpOnly
 * cookies, OTP/email verification, refresh, password recovery).
 * BRD / FR reference: FR-AUTH-001..007
 *
 * What this mock DOES do, so the UI is built against real behaviour:
 *  - checks passwords and shows one generic error (never reveals whether the
 *    email or the password was wrong)
 *  - locks an email for 15 minutes after 5 failed attempts
 *  - enforces password rules
 *  - never lets the browser choose its own role in a production build
 *
 * What it CANNOT do (the server must):
 *  - keep secrets, rate-limit across devices, verify email/phone ownership,
 *    or stop someone editing localStorage. NOTHING here is a security
 *    boundary. Roles, vendor approval and admin rights MUST be decided and
 *    checked by the server on every request.
 */

export interface RegisterData {
  name: string
  email: string
  phone: string
  password: string
  /** Only 'vendor' is honoured. Anything else becomes 'customer'. */
  role?: Role
  businessName?: string
}

export type AuthResult = { ok: true } | { ok: false; error: string }

interface StoredAccount {
  user: User
  salt: string
  hash: string
  /** Deactivated accounts can't sign in (for example a driver who left). */
  disabled?: boolean
  /** Staff member who created this account. */
  createdBy?: string
}

export type CreateStaffResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string }

interface Attempts {
  count: number
  lockedUntil?: number
}

interface AuthState {
  user: User | null
  accounts: Record<string, StoredAccount>
  attempts: Record<string, Attempts>
  isAuthenticated: boolean

  login: (email: string, password: string) => Promise<AuthResult>
  register: (data: RegisterData) => Promise<AuthResult>
  logout: () => void

  /** Signed-in user edits their own name and phone. Email changes need server-side verification. */
  updateProfile: (data: { name: string; phone: string }) => AuthResult

  /** Customers only. Vendors and staff must go through Karta support. */
  deleteOwnAccount: (password: string) => Promise<AuthResult>

  /** Signed-in user changes their own password. Clears `mustChangePassword`. */
  changePassword: (current: string, next: string) => Promise<AuthResult>

  /** Admin only. Staff roles are never self-service. */
  createLogisticsAccount: (data: {
    name: string
    email: string
    phone: string
  }) => Promise<CreateStaffResult>
  setAccountDisabled: (email: string, disabled: boolean) => AuthResult

  /**
   * Admin only. Upgrades an existing CUSTOMER account to a driver after their
   * application was verified. No other role can be granted this way.
   */
  grantLogisticsRole: (email: string) => AuthResult

  /**
   * Called after a code was confirmed. The target must be the signed-in user's
   * CURRENT email/phone. (In production the server sets this flag itself.)
   */
  markContactVerified: (channel: 'email' | 'phone', target: string) => AuthResult

  /**
   * Sets a new password after an emailed code was confirmed. Also clears any
   * lockout. (Server-side only in production.)
   */
  applyPasswordReset: (email: string, newPassword: string) => Promise<AuthResult>

  /** Re-reads the signed-in user's record (for example after an approval). */
  refreshSession: () => void

  /** DEV builds only. Always returns false in production. */
  devLogin: (email: string, role: Role) => boolean
}

export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

const GENERIC_FAILURE = 'Incorrect email or password.'

const normalise = (email: string) => email.trim().toLowerCase()

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const minutesLeft = (until: number, now = Date.now()) =>
  Math.max(1, Math.ceil((until - now) / 60_000))

const isStaff = (u: User | null) => Boolean(u && (u.role === 'admin' || u.role === 'super_admin'))

/** Readable one-time password: no look-alike characters (0/O, 1/l/I). */
function makeTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = letters + digits
  const bytes = new Uint8Array(12)

  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)

  const chars = Array.from(bytes, (b) => all[b % all.length])
  // Guarantee at least one letter and one digit.
  chars[0] = letters[bytes[0] % letters.length]
  chars[11] = digits[bytes[11] % digits.length]
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`
}

const nameFromEmail = (email: string) =>
  (email.split('@')[0] ?? '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Karta Customer'

/* -------------------------------------------------------------------------- */

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: {},
      attempts: {},
      isAuthenticated: false,

      login: async (rawEmail, password) => {
        const email = normalise(rawEmail)
        const state = get()
        const lock = state.attempts[email]

        if (lock?.lockedUntil && lock.lockedUntil > Date.now()) {
          return {
            ok: false,
            error: `Too many failed attempts. Try again in ${minutesLeft(lock.lockedUntil)} minute(s).`,
          }
        }

        const account = state.accounts[email]

        // Always do the hashing work so "unknown email" takes as long as "wrong
        // password" and can't be told apart by timing.
        const probe = await hashPassword(password, account?.salt ?? 'unknown-account-salt')
        const valid = Boolean(account) && safeEqual(probe, account!.hash)

        if (!valid) {
          const count = (lock?.lockedUntil && lock.lockedUntil <= Date.now() ? 0 : lock?.count ?? 0) + 1
          const locked = count >= MAX_ATTEMPTS

          set((s) => ({
            attempts: {
              ...s.attempts,
              [email]: { count: locked ? 0 : count, lockedUntil: locked ? Date.now() + LOCKOUT_MS : undefined },
            },
          }))

          return {
            ok: false,
            error: locked
              ? `Too many failed attempts. Try again in ${minutesLeft(Date.now() + LOCKOUT_MS)} minutes.`
              : GENERIC_FAILURE,
          }
        }

        if (account!.disabled) {
          return { ok: false, error: 'This account has been deactivated. Please contact Karta support.' }
        }

        set((s) => {
          const rest = { ...s.attempts }
          delete rest[email]
          return { user: account!.user, isAuthenticated: true, attempts: rest }
        })

        return { ok: true }
      },

      register: async (data) => {
        const email = normalise(data.email)

        if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' }

        const problem = passwordProblem(data.password, email)
        if (problem) return { ok: false, error: problem }

        if (get().accounts[email]) {
          // Same message whether or not it exists would be ideal against
          // enumeration; the server can email the owner instead.
          return { ok: false, error: 'An account with this email already exists. Sign in instead.' }
        }

        // Customers and vendors only. Staff roles are never self-service.
        const isVendor = data.role === 'vendor'
        const businessName = data.businessName?.trim()

        const user: User = {
          id: uuid(),
          name: data.name.trim(),
          email,
          phone: data.phone.trim(),
          role: isVendor ? 'vendor' : 'customer',
          ...(isVendor && businessName ? { businessName } : {}),
        }

        const salt = newSalt()
        const hash = await hashPassword(data.password, salt)

        set((s) => ({
          user,
          isAuthenticated: true,
          accounts: { ...s.accounts, [email]: { user, salt, hash } },
        }))

        return { ok: true }
      },

      logout: () => set({ user: null, isAuthenticated: false }),

      grantLogisticsRole: (rawEmail) => {
        const me = get().user
        if (!isStaff(me)) return { ok: false, error: 'Only Karta staff can approve drivers.' }

        const email = normalise(rawEmail)
        const account = get().accounts[email]
        if (!account) return { ok: false, error: 'No account exists for this applicant.' }
        if (account.disabled) return { ok: false, error: 'This account is deactivated.' }
        if (account.user.role !== 'customer') {
          return { ok: false, error: 'Only customer accounts can be upgraded to driver.' }
        }

        const user: User = { ...account.user, role: 'logistics' }
        set((s) => ({ accounts: { ...s.accounts, [email]: { ...account, user } } }))
        return { ok: true }
      },

      markContactVerified: (channel, target) => {
        const me = get().user
        const k = me ? normalise(me.email) : ''
        const account = get().accounts[k]
        if (!me || !account) return { ok: false, error: 'Please sign in again.' }

        const matches = channel === 'email' ? normalise(target) === k : samePhone(target, me.phone ?? '')
        if (!matches) return { ok: false, error: 'That isn’t the contact detail on your account.' }

        const user: User = { ...me, [channel === 'email' ? 'emailVerified' : 'phoneVerified']: true }
        set((s) => ({ user, accounts: { ...s.accounts, [k]: { ...account, user } } }))
        return { ok: true }
      },

      applyPasswordReset: async (rawEmail, newPassword) => {
        const email = normalise(rawEmail)
        const account = get().accounts[email]
        if (!account) return { ok: false, error: 'We couldn’t reset that account.' }
        if (account.disabled) return { ok: false, error: 'This account has been deactivated. Please contact Karta support.' }

        const problem = passwordProblem(newPassword, email)
        if (problem) return { ok: false, error: problem }

        const salt = newSalt()
        const hash = await hashPassword(newPassword, salt)
        // Owning the email proves ownership, so a forced change is satisfied too.
        const user: User = { ...account.user, mustChangePassword: false, emailVerified: true }

        set((s) => {
          const attempts = { ...s.attempts }
          delete attempts[email]
          return {
            attempts,
            accounts: { ...s.accounts, [email]: { ...account, user, salt, hash } },
            user: s.user && normalise(s.user.email) === email ? user : s.user,
          }
        })

        return { ok: true }
      },

      refreshSession: () => {
        const me = get().user
        const account = me ? get().accounts[normalise(me.email)] : undefined
        if (me && account && !account.disabled && account.user.role !== me.role) {
          set({ user: account.user })
        }
      },

      updateProfile: ({ name, phone }) => {
        const me = get().user
        const k = me ? normalise(me.email) : ''
        const account = get().accounts[k]
        if (!me || !account) return { ok: false, error: 'Please sign in again.' }

        const cleanName = name.trim().replace(/\s+/g, ' ')
        if (cleanName.length < 2) return { ok: false, error: 'Enter your full name.' }
        if (cleanName.length > 80) return { ok: false, error: 'Your name is too long (80 characters maximum).' }
        if (!isNigerianPhone(phone)) return { ok: false, error: 'Enter a valid Nigerian phone number, for example 0803 123 4567.' }

        const phoneChanged = !samePhone(phone, me.phone ?? '')
        const user: User = { ...me, name: cleanName, phone: phone.trim(), ...(phoneChanged ? { phoneVerified: false } : {}) }

        set((s) => ({ user, accounts: { ...s.accounts, [k]: { ...account, user } } }))
        return { ok: true }
      },

      deleteOwnAccount: async (password) => {
        const me = get().user
        const k = me ? normalise(me.email) : ''
        const account = get().accounts[k]
        if (!me || !account) return { ok: false, error: 'Please sign in again.' }

        if (me.role !== 'customer') {
          return { ok: false, error: 'Vendor and staff accounts are closed by Karta support so open orders and payouts are settled first.' }
        }

        const probe = await hashPassword(password, account.salt)
        if (!safeEqual(probe, account.hash)) return { ok: false, error: 'That password is incorrect.' }

        set((s) => {
          const accounts = { ...s.accounts }
          delete accounts[k]
          return { user: null, isAuthenticated: false, accounts }
        })

        return { ok: true }
      },

      changePassword: async (current, next) => {
        const me = get().user
        const account = me ? get().accounts[normalise(me.email)] : undefined
        if (!me || !account) return { ok: false, error: 'Please sign in again.' }

        const probe = await hashPassword(current, account.salt)
        if (!safeEqual(probe, account.hash)) return { ok: false, error: 'Your current password is incorrect.' }

        if (next === current) return { ok: false, error: 'Choose a password you haven’t used just now.' }

        const problem = passwordProblem(next, me.email)
        if (problem) return { ok: false, error: problem }

        const salt = newSalt()
        const hash = await hashPassword(next, salt)
        const user: User = { ...me, mustChangePassword: false }

        set((s) => ({
          user,
          accounts: { ...s.accounts, [normalise(me.email)]: { ...account, user, salt, hash } },
        }))

        return { ok: true }
      },

      createLogisticsAccount: async ({ name, email: rawEmail, phone }) => {
        const me = get().user
        if (!isStaff(me)) return { ok: false, error: 'Only Karta staff can create driver accounts.' }

        const email = normalise(rawEmail)
        if (name.trim().length < 2) return { ok: false, error: 'Enter the driver’s full name.' }
        if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' }
        if (!isNigerianPhone(phone)) return { ok: false, error: 'Enter a valid Nigerian phone number.' }
        if (get().accounts[email]) return { ok: false, error: 'An account with this email already exists.' }

        const tempPassword = makeTempPassword()
        const salt = newSalt()
        const hash = await hashPassword(tempPassword, salt)

        const user: User = {
          id: uuid(),
          name: name.trim(),
          email,
          phone: phone.trim(),
          role: 'logistics',
          mustChangePassword: true,
        }

        set((s) => ({
          accounts: { ...s.accounts, [email]: { user, salt, hash, createdBy: me!.email } },
        }))

        // Shown to the admin once. The driver must change it at first sign-in.
        return { ok: true, tempPassword }
      },

      setAccountDisabled: (rawEmail, disabled) => {
        const me = get().user
        if (!isStaff(me)) return { ok: false, error: 'Only Karta staff can do this.' }

        const email = normalise(rawEmail)
        const account = get().accounts[email]

        if (!account) return { ok: false, error: 'Account not found.' }
        if (email === normalise(me!.email)) return { ok: false, error: 'You can’t deactivate your own account.' }
        if (account.user.role !== 'logistics') return { ok: false, error: 'Only driver accounts can be changed here.' }

        set((s) => ({ accounts: { ...s.accounts, [email]: { ...account, disabled } } }))
        return { ok: true }
      },

      devLogin: (rawEmail, role) => {
        // Compiled out of production behaviour: cannot grant roles there.
        if (!import.meta.env.DEV) return false

        const email = normalise(rawEmail)
        const existing = get().accounts[email]?.user

        const user: User =
          existing && existing.role === role
            ? existing
            : { id: uuid(), name: nameFromEmail(email), email, role, emailVerified: true, phoneVerified: true }

        set((s) => ({
          user,
          isAuthenticated: true,
          accounts: {
            ...s.accounts,
            // Unusable password: dev accounts can't be signed into normally.
            [email]: s.accounts[email]?.user.role === role ? s.accounts[email] : { user, salt: 'dev', hash: 'dev-no-password' },
          },
        }))

        return true
      },
    }),
    {
      name: 'karta-auth',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      // v1 stored accounts without passwords; those can't be trusted, so
      // people re-register. (Only affects the prototype.)
      migrate: () => ({ user: null, accounts: {}, attempts: {}, isAuthenticated: false }),
    },
  ),
)

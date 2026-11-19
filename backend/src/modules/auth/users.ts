import { get, run, type Db } from '../../platform/db.ts'
import type { AuthUser, Role } from '../../platform/http.ts'
import { normalisePhone } from '../../platform/validate.ts'

export interface UserRow {
  id: string
  email: string
  name: string
  phone: string | null
  phone_norm: string | null
  role: Role
  password_hash: string | null
  must_change_password: number
  business_name: string | null
  email_verified_at: string | null
  phone_verified_at: string | null
  disabled_at: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export const findUserByEmail = (db: Db, email: string) => get<UserRow>(db, 'SELECT * FROM users WHERE email = ?', email.toLowerCase())
export const findUserById = (db: Db, id: string) => get<UserRow>(db, 'SELECT * FROM users WHERE id = ?', id)

export function insertUser(db: Db, u: {
  id: string; email: string; name: string; phone?: string; role: Role; passwordHash: string; mustChangePassword?: boolean
  businessName?: string; createdBy?: string; emailVerifiedAt?: string; now: string
}) {
  run(db,
    `INSERT INTO users (id,email,name,phone,phone_norm,role,password_hash,must_change_password,business_name,email_verified_at,created_by,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    u.id, u.email.toLowerCase(), u.name, u.phone, u.phone ? normalisePhone(u.phone) : undefined, u.role, u.passwordHash,
    u.mustChangePassword ? 1 : 0, u.businessName, u.emailVerifiedAt, u.createdBy, u.now, u.now)
}

/** What the API shows about a user. Never includes the password hash. */
export function publicUser(r: UserRow) {
  return {
    id: r.id, email: r.email, name: r.name, phone: r.phone, role: r.role, businessName: r.business_name,
    mustChangePassword: r.must_change_password === 1,
    emailVerified: r.email_verified_at !== null,
    phoneVerified: r.phone_verified_at !== null,
    createdAt: r.created_at,
  }
}

export const toAuthUser = (r: UserRow, familyId: string): AuthUser => ({
  id: r.id, email: r.email, name: r.name, phone: r.phone, role: r.role, businessName: r.business_name,
  mustChangePassword: r.must_change_password === 1,
  emailVerified: r.email_verified_at !== null,
  phoneVerified: r.phone_verified_at !== null,
  familyId,
})

/** Deactivated or deleted accounts can't use the API, even with a valid token. */
export const isUsable = (r: UserRow) => r.disabled_at === null && r.deleted_at === null

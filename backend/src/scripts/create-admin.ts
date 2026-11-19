// Creates the FIRST admin. Admins can't register themselves, so this is the only way in.
//   ADMIN_EMAIL=you@karta.example ADMIN_NAME="Your Name" ADMIN_PASSWORD='long-unique-pass' npm run create-admin
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../config.ts'
import { passwordProblem } from '../modules/auth/passwordPolicy.ts'
import { findUserByEmail, insertUser } from '../modules/auth/users.ts'
import { hashPassword, newId } from '../platform/crypto.ts'
import { migrate, openDb } from '../platform/db.ts'

const config = loadConfig()
const { ADMIN_EMAIL: email, ADMIN_NAME: name, ADMIN_PASSWORD: password } = process.env
if (!email || !name || !password) { console.error('Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD.'); process.exit(1) }

const problem = passwordProblem(password, email)
if (problem) { console.error(problem); process.exit(1) }

const db = openDb(config.dbPath)
migrate(db, join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations'))
if (findUserByEmail(db, email)) { console.error('That email already has an account.'); process.exit(1) }

const now = new Date().toISOString()
insertUser(db, { id: newId(), email, name, role: 'admin', passwordHash: await hashPassword(password, config.scryptN), emailVerifiedAt: now, now })
console.log(`Admin created: ${email.toLowerCase()}`)
db.close()

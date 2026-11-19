import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

export type Db = DatabaseSync
export type Param = SQLInputValue | undefined

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  return db
}

/** Applies each migrations/*.sql once, in name order, each inside a transaction. */
export function migrate(db: Db, dir: string): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  const done = new Set((db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name))
  const applied: string[] = []

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    db.exec('BEGIN')
    try {
      db.exec(readFileSync(join(dir, file), 'utf8'))
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
      db.exec('COMMIT')
      applied.push(file)
    } catch (e) {
      db.exec('ROLLBACK')
      throw new Error(`Migration ${file} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return applied
}

/* Thin typed helpers: undefined becomes NULL, which SQLite requires. */
const clean = (p: Param[]) => p.map((x) => (x === undefined ? null : x)) as SQLInputValue[]

export const get = <T>(db: Db, sql: string, ...p: Param[]) => db.prepare(sql).get(...clean(p)) as T | undefined
export const all = <T>(db: Db, sql: string, ...p: Param[]) => db.prepare(sql).all(...clean(p)) as T[]
export const run = (db: Db, sql: string, ...p: Param[]) => db.prepare(sql).run(...clean(p))

/**
 * Runs `fn` atomically: everything inside commits together or not at all.
 * BEGIN IMMEDIATE takes the write lock up front, so two requests can't both pass
 * a "check then write" sequence (this is what makes "first one wins" safe).
 * Transactions must not be nested.
 */
const open = new WeakSet<Db>()
export function tx<T>(db: Db, fn: () => T): T {
  if (open.has(db)) throw new Error('Nested transactions are not supported')
  open.add(db)
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  } finally {
    open.delete(db)
  }
}

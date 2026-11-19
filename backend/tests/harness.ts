import { createServer, type Server } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import type { Deps } from '../src/deps.ts'
import { findUserByEmail, insertUser } from '../src/modules/auth/users.ts'
import { hashPassword, newId } from '../src/platform/crypto.ts'
import { migrate, openDb } from '../src/platform/db.ts'
import { silentLogger } from '../src/platform/logger.ts'
import { MemoryNotifier } from '../src/platform/notifier.ts'
import { RateLimiter } from '../src/platform/ratelimit.ts'

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
export const ORIGIN = 'http://localhost:5173'
export const PASSWORD = 'Tr1cky-Walnut-Table'

export interface Res { status: number; body: any; headers: Headers }
interface CallOpts { headers?: Record<string, string>; csrf?: boolean; raw?: string; contentType?: string }

/** A browser stand-in: keeps cookies (respecting Path) and talks to the real server. */
let ipCounter = 0
export class Client {
  jar = new Map<string, { value: string; path: string }>()
  private base: string
  /** Every simulated browser has its own IP, like real users. */
  ip: string
  constructor(base: string, ip?: string) {
    this.base = base
    this.ip = ip ?? `10.${(++ipCounter >> 8) & 255}.${ipCounter & 255}.7`
  }

  cookie(name: string) { return this.jar.get(name)?.value }
  setCookie(name: string, value: string, path = '/') { this.jar.set(name, { value, path }) }

  async call(method: string, path: string, body?: unknown, o: CallOpts = {}): Promise<Res> {
    const cookies = [...this.jar].filter(([, c]) => path.startsWith(c.path)).map(([k, c]) => `${k}=${encodeURIComponent(c.value)}`).join('; ')
    const headers: Record<string, string> = { 'x-forwarded-for': this.ip, ...(cookies ? { cookie: cookies } : {}), ...(o.headers ?? {}) }
    if (o.csrf !== false && method !== 'GET') headers['x-karta-client'] = 'web'
    let payload: string | undefined
    if (o.raw !== undefined) { payload = o.raw; headers['content-type'] = o.contentType ?? 'application/json' }
    else if (body !== undefined) { payload = JSON.stringify(body); headers['content-type'] = o.contentType ?? 'application/json' }

    const res = await fetch(this.base + path, { method, headers, body: payload })
    for (const sc of res.headers.getSetCookie()) {
      const [pair, ...attrs] = sc.split('; ')
      const i = (pair as string).indexOf('=')
      const name = (pair as string).slice(0, i)
      const value = decodeURIComponent((pair as string).slice(i + 1))
      const pathAttr = attrs.find((a) => a.startsWith('Path='))?.slice(5) ?? '/'
      if (attrs.some((a) => a === 'Max-Age=0')) this.jar.delete(name)
      else this.jar.set(name, { value, path: pathAttr })
    }
    const text = await res.text()
    let parsed: any = undefined
    try { parsed = text ? JSON.parse(text) : undefined } catch { parsed = text }
    return { status: res.status, body: parsed, headers: res.headers }
  }
  get = (p: string, o?: CallOpts) => this.call('GET', p, undefined, o)
  post = (p: string, b?: unknown, o?: CallOpts) => this.call('POST', p, b ?? {}, o)
  put = (p: string, b?: unknown, o?: CallOpts) => this.call('PUT', p, b ?? {}, o)
  patch = (p: string, b?: unknown, o?: CallOpts) => this.call('PATCH', p, b ?? {}, o)
  del = (p: string, b?: unknown, o?: CallOpts) => this.call('DELETE', p, b ?? {}, o)
}

export interface Harness {
  url: string
  deps: Deps
  notifier: MemoryNotifier
  advance(ms: number): void
  client(ip?: string): Client
  close(): Promise<void>
  /** Creates an admin directly in the database (admins can never self-register). */
  makeAdmin(email?: string, role?: 'admin' | 'super_admin'): Promise<Client>
}

export async function start(env: Record<string, string> = {}): Promise<Harness> {
  let offset = 0
  const clock = { now: () => Date.now() + offset }
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:', JWT_SECRET: 'test-secret-test-secret-test-secret-123', CORS_ORIGINS: ORIGIN, EXPOSE_DEV_CODES: 'false', TRUST_PROXY: 'true', ...env })
  const db = openDb(':memory:')
  migrate(db, MIGRATIONS)
  const notifier = new MemoryNotifier()
  const deps: Deps = { config, db, clock, log: silentLogger, notifier, limiter: new RateLimiter(clock) }

  const handler = createApp(deps)
  const server: Server = createServer((req, res) => void handler(req, res))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`

  const h: Harness = {
    url, deps, notifier,
    advance: (ms) => { offset += ms },
    client: (ip) => new Client(url, ip),
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => { db.close(); r() }) }),
    async makeAdmin(email = 'admin@karta.test', role = 'admin') {
      if (!findUserByEmail(db, email)) insertUser(db, { id: newId(), email, name: 'Admin One', role, passwordHash: await hashPassword(PASSWORD, config.scryptN), emailVerifiedAt: new Date().toISOString(), now: new Date().toISOString() })
      const c = h.client()
      const r = await c.post('/api/auth/login', { email, password: PASSWORD })
      if (r.status !== 200) throw new Error(`admin login failed: ${JSON.stringify(r.body)}`)
      return c
    },
  }
  return h
}

let n = 0
export const uniqueEmail = (p = 'user') => `${p}${++n}@mail.test`
export const uniquePhone = () => `0803${String(1000000 + ++n).slice(0, 7)}`

export const newUser = (over: Record<string, unknown> = {}) => ({
  name: 'Chidinma Okafor', email: uniqueEmail(), phone: uniquePhone(), password: PASSWORD, ...over,
})

/** Registers and returns a signed-in client plus the account details. */
export async function signUp(h: Harness, over: Record<string, unknown> = {}) {
  const c = h.client()
  const u = newUser(over)
  const r = await c.post('/api/auth/register', u)
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`)
  return { c, u, user: r.body.user }
}

/** Runs the real code flow for a channel using the code the notifier "sent". */
export async function verify(h: Harness, c: Client, channel: 'email' | 'phone', to: string) {
  const r = await c.post('/api/verification/request', { channel })
  if (r.status !== 200) throw new Error(`request failed: ${JSON.stringify(r.body)}`)
  const code = h.notifier.last(to)!.code
  const ok = await c.post('/api/verification/confirm', { channel, code })
  if (ok.status !== 200) throw new Error(`confirm failed: ${JSON.stringify(ok.body)}`)
}

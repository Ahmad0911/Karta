import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Deps } from '../deps.ts'
import { AppError, forbidden, notFound, unauthorized } from './errors.ts'
import { newId } from './crypto.ts'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Role = 'customer' | 'vendor' | 'logistics' | 'admin' | 'super_admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: Role
  businessName: string | null
  mustChangePassword: boolean
  emailVerified: boolean
  phoneVerified: boolean
  /** Session family that issued this request's token. */
  familyId: string
}

export interface CookieOptions {
  maxAgeSec?: number
  path?: string
}

export interface Ctx {
  deps: Deps
  req: IncomingMessage
  res: ServerResponse
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  ip: string
  requestId: string
  user: AuthUser | null
  cookies: Record<string, string>
  readonly sent: boolean
  json(status: number, body?: unknown): void
  setCookie(name: string, value: string, o?: CookieOptions): void
  clearCookie(name: string, path?: string): void
}

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown

interface Route {
  method: string
  keys: string[]
  re: RegExp
  handlers: Handler[]
}

/* -------------------------------------------------------------------------- */
/* Router                                                                     */
/* -------------------------------------------------------------------------- */

export class Router {
  routes: Route[] = []

  add(method: string, pattern: string, ...handlers: Handler[]) {
    const keys: string[] = []
    const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k: string) => (keys.push(k), '([^/]+)')) + '/?$')
    this.routes.push({ method, keys, re, handlers })
    return this
  }
  get = (p: string, ...h: Handler[]) => this.add('GET', p, ...h)
  post = (p: string, ...h: Handler[]) => this.add('POST', p, ...h)
  put = (p: string, ...h: Handler[]) => this.add('PUT', p, ...h)
  patch = (p: string, ...h: Handler[]) => this.add('PATCH', p, ...h)
  delete = (p: string, ...h: Handler[]) => this.add('DELETE', p, ...h)

  match(method: string, path: string): { route: Route; params: Record<string, string> } | 'method' | null {
    let pathMatched = false
    for (const route of this.routes) {
      const m = route.re.exec(path)
      if (!m) continue
      pathMatched = true
      if (route.method !== method) continue
      const params: Record<string, string> = {}
      route.keys.forEach((k, i) => {
        try { params[k] = decodeURIComponent(m[i + 1] as string) } catch { params[k] = m[i + 1] as string }
      })
      return { route, params }
    }
    return pathMatched ? 'method' : null
  }
}

/* -------------------------------------------------------------------------- */
/* Middleware you attach to routes                                            */
/* -------------------------------------------------------------------------- */

const ALLOWED_WHEN_PASSWORD_PENDING = new Set(['GET /api/auth/me', 'POST /api/auth/password/change', 'POST /api/auth/logout'])

export const requireAuth: Handler = (ctx) => {
  if (!ctx.user) throw unauthorized()
  // Accounts created with a temporary password may only change it.
  if (ctx.user.mustChangePassword && !ALLOWED_WHEN_PASSWORD_PENDING.has(`${ctx.method} ${ctx.path}`)) {
    throw forbidden('Please choose your own password before continuing.', 'password_change_required')
  }
}

export const requireRole = (...roles: Role[]): Handler => (ctx) => {
  void requireAuth(ctx)
  if (!roles.includes(ctx.user!.role)) throw forbidden()
}
export const staffOnly = requireRole('admin', 'super_admin')

/* -------------------------------------------------------------------------- */
/* Request pipeline                                                           */
/* -------------------------------------------------------------------------- */

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
/** Browsers can't add a custom header cross-site without CORS approval, which we only give to our own origins. */
export const CLIENT_HEADER = 'x-karta-client'

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 1) continue
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()) } catch { /* ignore malformed */ }
  }
  return out
}

async function readBody(req: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new AppError(413, 'payload_too_large', 'That request is too large.')
    chunks.push(chunk as Buffer)
  }
  if (size === 0) return {}
  const type = String(req.headers['content-type'] ?? '')
  if (!type.toLowerCase().startsWith('application/json')) throw new AppError(415, 'unsupported_media_type', 'Send JSON with Content-Type: application/json.')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new AppError(400, 'invalid_json', 'The request body isn’t valid JSON.')
  }
}

export interface AppOptions {
  deps: Deps
  router: Router
  /** Fills ctx.user from the cookie/bearer token. Must not throw for "no token". */
  authenticate: (ctx: Ctx) => Promise<AuthUser | null>
}

export function createHandler({ deps, router, authenticate }: AppOptions) {
  const { config, log, limiter } = deps
  const allowed = new Set(config.corsOrigins)

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now()
    const requestId = String(req.headers['x-request-id'] ?? '').slice(0, 64).replace(/[^\w.-]/g, '') || newId()
    const method = (req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', 'http://x')
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
    const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()
    const ip = (config.trustProxy && fwd) || req.socket.remoteAddress || 'unknown'

    const outCookies: string[] = []
    let sent = false

    // ---- headers every response gets ------------------------------------------------
    res.setHeader('X-Request-Id', requestId)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
    if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    const originAllowed = origin !== undefined && allowed.has(origin)
    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
    }

    const send = (status: number, body?: unknown) => {
      if (sent) return
      sent = true
      if (outCookies.length) res.setHeader('Set-Cookie', outCookies)
      if (body === undefined) {
        res.writeHead(status).end()
      } else {
        const text = JSON.stringify(body)
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) }).end(text)
      }
    }

    const ctx: Ctx = {
      deps, req, res, method, path: url.pathname, params: {}, query: url.searchParams, body: {}, ip, requestId, user: null,
      cookies: parseCookies(req.headers.cookie),
      get sent() { return sent },
      json: send,
      setCookie(name, value, o = {}) {
        const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? '/'}`, 'HttpOnly', 'SameSite=Lax']
        if (config.cookieSecure) parts.push('Secure')
        if (o.maxAgeSec !== undefined) parts.push(`Max-Age=${o.maxAgeSec}`)
        outCookies.push(parts.join('; '))
      },
      clearCookie(name, path = '/') {
        outCookies.push(`${name}=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0${config.cookieSecure ? '; Secure' : ''}`)
      },
    }

    let userId: string | undefined
    try {
      // ---- CORS preflight -----------------------------------------------------------
      if (method === 'OPTIONS') {
        if (!originAllowed) throw forbidden('That origin isn’t allowed.', 'origin_not_allowed')
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', `Content-Type,${CLIENT_HEADER},X-Request-Id`)
        res.setHeader('Access-Control-Max-Age', '600')
        return send(204)
      }

      // ---- blanket abuse limit ------------------------------------------------------
      const wait = limiter.check(`ip:${ip}`, 600, 60_000)
      if (wait) {
        res.setHeader('Retry-After', String(wait))
        throw new AppError(429, 'rate_limited', 'Too many requests. Please slow down.', { retryAfterSec: wait })
      }

      // ---- CSRF: state-changing calls must come from our own web client -------------
      if (STATE_CHANGING.has(method)) {
        if (origin !== undefined && !originAllowed) throw forbidden('That origin isn’t allowed.', 'origin_not_allowed')
        if (String(req.headers[CLIENT_HEADER] ?? '').toLowerCase() !== 'web') throw forbidden('Missing client header.', 'csrf_blocked')
      }

      const m = router.match(method, ctx.path)
      if (m === null) throw notFound('No such endpoint.')
      if (m === 'method') throw new AppError(405, 'method_not_allowed', 'That method isn’t allowed here.')
      ctx.params = m.params

      if (STATE_CHANGING.has(method)) ctx.body = await readBody(req, config.bodyLimitBytes)

      ctx.user = await authenticate(ctx)
      userId = ctx.user?.id

      let result: unknown
      for (const h of m.route.handlers) {
        result = await h(ctx)
        if (sent) break
      }
      if (!sent) result === undefined ? send(204) : send(200, result)
    } catch (e) {
      if (e instanceof AppError) {
        if (e.status === 429 && typeof e.details?.retryAfterSec === 'number') res.setHeader('Retry-After', String(e.details.retryAfterSec))
        if (e.status === 413) res.setHeader('Connection', 'close')
        send(e.status, { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}), requestId } })
      } else {
        // A bug. Log it fully, tell the caller nothing about it.
        log.log('error', 'unhandled', { requestId, error: e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e) })
        send(500, { error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.', requestId } })
      }
    } finally {
      log.log('info', 'request', { requestId, method, path: ctx.path, status: res.statusCode, ms: Date.now() - started, userId })
    }
  }
}

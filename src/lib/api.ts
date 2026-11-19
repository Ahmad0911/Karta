/**
 * The one way the web app talks to the Karta API.
 *
 *  - Cookies carry the session (httpOnly, so scripts can't read them).
 *  - Every state-changing call sends `x-karta-client: web`; the server refuses
 *    requests without it (CSRF protection).
 *  - A 401 triggers ONE token refresh, then the call is retried once. Refreshes
 *    are shared: the server treats a replayed refresh token as theft and ends the
 *    session, so two tabs must never refresh at the same time.
 */

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

/** Headers every API call must carry. Reused by adapters that call fetch themselves. */
export const API_HEADERS = { 'Content-Type': 'application/json', 'x-karta-client': 'web' } as const

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Field-by-field messages for 422 responses, ready to show under inputs. */
  readonly fields: Record<string, string>
  readonly retryAfterSec?: number
  readonly details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
    this.fields = (details.fields as Record<string, string> | undefined) ?? {}
    this.retryAfterSec = typeof details.retryAfterSec === 'number' ? details.retryAfterSec : undefined
  }
}

let refreshing: Promise<boolean> | null = null

/** Returns true when a fresh session was obtained. Concurrent callers share one request. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: API_HEADERS, body: '{}' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

const NO_REFRESH = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/password/forgot', '/auth/password/reset'])

export async function api<T = unknown>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  if (!API_BASE) throw new ApiError(0, 'api_not_configured', 'The server isn’t configured yet (VITE_API_URL is missing).')

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: API_HEADERS,
      body: method === 'GET' || body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network_error', 'We couldn’t reach the server. Check your connection and try again.')
  }

  if (res.status === 401 && !retried && !NO_REFRESH.has(path) && (await refreshSession())) {
    return api<T>(method, path, body, true)
  }

  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined

  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | undefined)?.error
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong. Please try again.', e?.details)
  }
  return data as T
}

export const apiGet = <T>(path: string) => api<T>('GET', path)
export const apiPost = <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {})
export const apiPut = <T>(path: string, body?: unknown) => api<T>('PUT', path, body ?? {})
export const apiPatch = <T>(path: string, body?: unknown) => api<T>('PATCH', path, body ?? {})
export const apiDelete = <T>(path: string, body?: unknown) => api<T>('DELETE', path, body ?? {})

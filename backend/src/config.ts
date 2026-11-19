export type Env = 'development' | 'test' | 'production'

export interface Config {
  env: Env
  port: number
  dbPath: string
  jwtSecret: string
  corsOrigins: string[]
  cookieSecure: boolean
  trustProxy: boolean
  notifier: 'console' | 'none'
  exposeDevCodes: boolean
  /** scrypt cost (N). Stored inside every hash, so it can be raised later. */
  scryptN: number
  accessTtlSec: number
  refreshTtlSec: number
  bodyLimitBytes: number
  /** Paystack secret key (sk_test_… / sk_live_…). Empty = payments disabled. Server only. */
  paystackSecretKey: string
}

const DEV_SECRET = 'dev-only-secret-change-me-dev-only-secret'

/** Reads and VALIDATES configuration. Fails fast on anything unsafe in production. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const mode = (env.NODE_ENV ?? 'development') as Env
  if (!['development', 'test', 'production'].includes(mode)) throw new Error(`NODE_ENV must be development, test or production (got "${env.NODE_ENV}")`)

  const prod = mode === 'production'
  const origins = (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean)
  const notifier = (env.NOTIFIER ?? 'console') as Config['notifier']
  const secret = env.JWT_SECRET || (prod ? '' : DEV_SECRET)

  const problems: string[] = []
  if (env.PAYSTACK_SECRET_KEY && !/^sk_(test|live)_\w+$/.test(env.PAYSTACK_SECRET_KEY)) problems.push('PAYSTACK_SECRET_KEY must look like sk_test_… or sk_live_… (never the public pk_ key)')
  if (!['console', 'none'].includes(notifier)) problems.push('NOTIFIER must be "console" or "none"')
  if (origins.some((o) => o === '*' || !/^https?:\/\/[^/]+$/.test(o))) problems.push('CORS_ORIGINS must be exact origins like https://karta.example (no "*", no paths)')
  if (prod) {
    if (secret.length < 32 || secret === DEV_SECRET) problems.push('JWT_SECRET must be set to 32+ random characters in production')
    if (notifier === 'console') problems.push('NOTIFIER=console would print verification codes to the logs. Wire a real provider (or NOTIFIER=none) in production')
    if (env.EXPOSE_DEV_CODES === 'true') problems.push('EXPOSE_DEV_CODES must not be true in production')
    if ((env.DATABASE_PATH ?? '') === ':memory:') problems.push('DATABASE_PATH cannot be :memory: in production')
    if (origins.some((o) => o.startsWith('http://'))) problems.push('CORS_ORIGINS must be https:// in production')
    if (env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith('sk_live_')) problems.push('PAYSTACK_SECRET_KEY must be a live key (sk_live_…) in production')
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`)

  return {
    env: mode,
    port: Number(env.PORT ?? 3000),
    dbPath: env.DATABASE_PATH ?? './data/karta.db',
    jwtSecret: secret,
    corsOrigins: origins,
    cookieSecure: prod,
    trustProxy: env.TRUST_PROXY === 'true',
    notifier,
    exposeDevCodes: !prod && env.EXPOSE_DEV_CODES === 'true',
    scryptN: mode === 'test' ? 1024 : 2 ** 15,
    accessTtlSec: 15 * 60,
    refreshTtlSec: 30 * 24 * 3600,
    bodyLimitBytes: 100 * 1024,
    paystackSecretKey: env.PAYSTACK_SECRET_KEY ?? '',
  }
}

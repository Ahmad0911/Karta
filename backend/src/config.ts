export type Env = 'development' | 'test' | 'production'

export interface Config {
  env: Env
  port: number
  dbPath: string
  jwtSecret: string
  corsOrigins: string[]
  cookieSecure: boolean
  trustProxy: boolean
  /** console = print codes (dev). none = send nothing (tests). live = Termii SMS + Resend email. */
  notifier: 'console' | 'none' | 'live'
  /** Only set when notifier is 'live'. Server only. */
  live?: import('./platform/notifier.ts').LiveNotifierConfig
  exposeDevCodes: boolean
  /** scrypt cost (N). Stored inside every hash, so it can be raised later. */
  scryptN: number
  accessTtlSec: number
  refreshTtlSec: number
  bodyLimitBytes: number
  /** Paystack secret key (sk_test_… / sk_live_…). Empty = payments disabled. Server only. */
  paystackSecretKey: string
  /** A rehearsal with test money on a real server. Never true for real customers. */
  staging: boolean
  /** Image hosting (Cloudinary). Unset = uploads disabled and any https image URL is accepted (dev/tests). */
  cloudinary?: { cloudName: string; apiKey: string; apiSecret: string }
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
  const cld = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter((k) => env[k])
  if (cld.length > 0 && cld.length < 3) problems.push('Cloudinary needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET together')
  if (env.CLOUDINARY_CLOUD_NAME && !/^[a-z0-9_-]+$/i.test(env.CLOUDINARY_CLOUD_NAME)) problems.push('CLOUDINARY_CLOUD_NAME looks wrong')
  if (env.PAYSTACK_SECRET_KEY && !/^sk_(test|live)_\w+$/.test(env.PAYSTACK_SECRET_KEY)) problems.push('PAYSTACK_SECRET_KEY must look like sk_test_… or sk_live_… (never the public pk_ key)')
  if (!['console', 'none', 'live'].includes(notifier)) problems.push('NOTIFIER must be "console", "none" or "live"')
  const liveKeys = ['TERMII_API_KEY', 'TERMII_SENDER_ID', 'RESEND_API_KEY', 'EMAIL_FROM'] as const
  if (notifier === 'live') {
    const missing = liveKeys.filter((k) => !env[k])
    if (missing.length) problems.push(`NOTIFIER=live needs ${missing.join(', ')}`)
    if (env.TERMII_CHANNEL && !['generic', 'dnd'].includes(env.TERMII_CHANNEL)) problems.push('TERMII_CHANNEL must be "generic" or "dnd"')
    if (env.EMAIL_FROM && !/^(.+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(env.EMAIL_FROM)) problems.push('EMAIL_FROM must look like "Karta <hello@yourdomain.com>"')
  }
  if (origins.some((o) => o === '*' || !/^https?:\/\/[^/]+$/.test(o))) problems.push('CORS_ORIGINS must be exact origins like https://karta.example (no "*", no paths)')
  // STAGING: a private rehearsal on a real server with TEST money. Everything stays locked down except that
  // Paystack test keys are allowed and verification codes are printed in the server log instead of sent.
  const staging = prod && env.STAGING === 'true'
  if (staging && env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_')) problems.push('STAGING=true cannot be combined with a live Paystack key. Remove STAGING before going live')
  if (staging && !['console', 'live'].includes(notifier)) problems.push('STAGING needs NOTIFIER=console (codes appear in the server log) or NOTIFIER=live')
  if (prod) {
    if (secret.length < 32 || secret === DEV_SECRET) problems.push('JWT_SECRET must be set to 32+ random characters in production')
    if (!staging && notifier !== 'live') problems.push('NOTIFIER must be "live" in production: "console" prints codes to the logs and "none" would silently never deliver them')
    if (env.EXPOSE_DEV_CODES === 'true') problems.push('EXPOSE_DEV_CODES must not be true in production')
    if ((env.DATABASE_PATH ?? '') === ':memory:') problems.push('DATABASE_PATH cannot be :memory: in production')
    if (origins.some((o) => o.startsWith('http://'))) problems.push('CORS_ORIGINS must be https:// in production')
    if (!staging && env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith('sk_live_')) problems.push('PAYSTACK_SECRET_KEY must be a live key (sk_live_…) in production')
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`)

  return {
    env: mode,
    staging,
    port: Number(env.PORT ?? 3000),
    dbPath: env.DATABASE_PATH ?? './data/karta.db',
    jwtSecret: secret,
    corsOrigins: origins,
    cookieSecure: prod,
    trustProxy: env.TRUST_PROXY === 'true',
    notifier,
    live: notifier === 'live'
      ? {
          termii: { apiKey: env.TERMII_API_KEY!, senderId: env.TERMII_SENDER_ID!, channel: (env.TERMII_CHANNEL as 'generic' | 'dnd' | undefined) ?? 'dnd' },
          resend: { apiKey: env.RESEND_API_KEY!, from: env.EMAIL_FROM! },
        }
      : undefined,
    exposeDevCodes: !prod && env.EXPOSE_DEV_CODES === 'true',
    scryptN: mode === 'test' ? 1024 : 2 ** 15,
    accessTtlSec: 15 * 60,
    refreshTtlSec: 30 * 24 * 3600,
    bodyLimitBytes: 100 * 1024,
    paystackSecretKey: env.PAYSTACK_SECRET_KEY ?? '',
    cloudinary: env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
      ? { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }
      : undefined,
  }
}

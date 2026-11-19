import type { Config } from './config.ts'
import type { Clock } from './platform/clock.ts'
import type { Db } from './platform/db.ts'
import type { Logger } from './platform/logger.ts'
import type { Notifier } from './platform/notifier.ts'
import type { RateLimiter } from './platform/ratelimit.ts'

/** Everything a service needs, passed in explicitly. Tests swap any of it. */
export interface Deps {
  config: Config
  db: Db
  clock: Clock
  notifier: Notifier
  limiter: RateLimiter
  log: Logger
}

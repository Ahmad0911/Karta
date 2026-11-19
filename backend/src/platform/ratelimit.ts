import type { Clock } from './clock.ts'

/** Fixed-window limiter, in memory. Fine for one server; move to Redis when you run several. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  private clock: Clock

  constructor(clock: Clock) {
    this.clock = clock
  }

  /** Returns 0 when allowed, otherwise the seconds to wait. */
  check(key: string, limit: number, windowMs: number): number {
    const now = this.clock.now()
    if (this.hits.size > 20_000) this.sweep(now)

    const h = this.hits.get(key)
    if (!h || h.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs })
      return 0
    }
    if (h.count >= limit) return Math.max(1, Math.ceil((h.resetAt - now) / 1000))
    h.count += 1
    return 0
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k)
  }
}

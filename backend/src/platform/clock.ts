/** All time goes through a Clock so tests can move time without waiting. */
export interface Clock {
  now(): number
}
export const systemClock: Clock = { now: () => Date.now() }
export const iso = (ms: number) => new Date(ms).toISOString()

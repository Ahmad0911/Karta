import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import type { Deps } from './deps.ts'
import { systemClock } from './platform/clock.ts'
import { migrate, openDb } from './platform/db.ts'
import { jsonLogger } from './platform/logger.ts'
import { consoleNotifier, noopNotifier } from './platform/notifier.ts'
import { RateLimiter } from './platform/ratelimit.ts'

const config = loadConfig()
const db = openDb(config.dbPath)
const applied = migrate(db, join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'))

const deps: Deps = {
  config, db, clock: systemClock, log: jsonLogger,
  notifier: config.notifier === 'console' ? consoleNotifier : noopNotifier,
  limiter: new RateLimiter(systemClock),
}

const handler = createApp(deps)
const server = createServer((req, res) => void handler(req, res))
server.listen(config.port, () => deps.log.log('info', 'listening', { port: config.port, env: config.env, migrations: applied }))

// Finish in-flight requests, then close the database cleanly.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    deps.log.log('info', 'shutting down', { sig })
    server.close(() => { db.close(); process.exit(0) })
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}

export type Level = 'debug' | 'info' | 'warn' | 'error'
export interface Logger {
  log(level: Level, msg: string, fields?: Record<string, unknown>): void
}

/** One JSON object per line, easy for any log pipeline. Never pass secrets or request bodies in here. */
export const jsonLogger: Logger = {
  log(level, msg, fields) {
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields })
    ;(level === 'error' ? process.stderr : process.stdout).write(line + '\n')
  },
}

export const silentLogger: Logger = { log() {} }

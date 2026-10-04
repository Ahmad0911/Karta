import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'

const SRC = process.cwd() + '/src/'

function tryResolve(base) {
  for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx']) {
    if (existsSync(c) && !c.endsWith('/') && /\.(tsx?|json)$/.test(c)) return c
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const r = tryResolve(SRC + specifier.slice(2))
    if (r) return { url: pathToFileURL(r).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith(pathToFileURL(SRC).href.replace(/\/$/, ''))) {
    const base = new URL(specifier, context.parentURL).pathname
    const r = tryResolve(base)
    if (r) return { url: pathToFileURL(r).href, shortCircuit: true }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.startsWith(pathToFileURL(SRC).href.replace(/\/$/, '')) && /\.tsx?$/.test(url)) {
    let source = readFileSync(new URL(url), 'utf8')
    source = source.replaceAll('import.meta.env', process.env.KARTA_DEV === '1' ? '({ DEV: true })' : '({})')
    return { format: 'module-typescript', source, shortCircuit: true }
  }
  return next(url, context)
}

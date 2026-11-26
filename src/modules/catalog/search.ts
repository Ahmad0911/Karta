import { categories } from '@/data/categories'
import { rooms } from '@/data/rooms'
import type { Product } from '@/types'

/**
 * Storefront search. Built so people find what they mean, not only what they type exactly:
 *  - synonyms ("couch" finds sofas, "closet" finds wardrobes), plurals ("wardrobes") and small typos ("dinning")
 *  - every word must match, ranked by where it matched (name > type > room > material > maker > description)
 *  - prices in the words themselves: "bed under 600k", "sofa over ₦300,000", "table between 200k and 500k"
 *  - when nothing matches exactly: the closest pieces, and a "did you mean"
 */

export type Sort = 'relevance' | 'price-asc' | 'price-desc' | 'rating'

export interface SearchFilters {
  q: string
  room?: string
  category?: string
  min?: number
  max?: number
  inStock?: boolean
  sort?: Sort
}

export interface SearchResult {
  products: Product[]
  /** exact = every word matched; related = only some did; none = nothing */
  mode: 'all' | 'exact' | 'related' | 'none'
  terms: string[]
  /** Prices read out of the words, e.g. "under 300k" */
  priceFromText: { min?: number; max?: number }
  /** A corrected spelling worth offering when nothing matched */
  didYouMean?: string
}

/* ------------------------------ text handling ----------------------------- */

const GROUPS: string[][] = [
  ['sofa', 'couch', 'settee', 'sectional', 'loveseat'],
  ['bed', 'divan', 'bedframe'],
  ['wardrobe', 'closet', 'armoire', 'cupboard'],
  ['chair', 'armchair', 'seat'],
  ['table', 'desk'],
  ['shelf', 'bookcase', 'bookshelf', 'shelving'],
  ['lamp', 'light', 'lighting', 'lantern'],
  ['rug', 'carpet'],
  ['tv', 'television', 'media'],
  ['nightstand', 'bedside'],
  ['dining', 'dinner'],
  ['outdoor', 'garden', 'patio'],
  ['decor', 'decoration', 'ornament'],
]
const ALTS = new Map<string, string[]>()
for (const g of GROUPS) for (const w of g) ALTS.set(w, g)

export const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

export function stem(w: string): string {
  if (w.length <= 3) return w
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.endsWith('ves')) return w.slice(0, -3) + 'f'
  if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2)
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

const STOP = new Set(['a', 'an', 'the', 'for', 'in', 'of', 'and', 'with', 'to', 'my', 'me', 'i', 'want', 'need', 'looking', 'buy'])

const tokens = (s: string) => normalise(s).split(' ').filter(Boolean).map(stem)

/** Optimal-string-alignment distance (counts a swapped pair as one slip). Gives up early past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? Infinity) + 1)
      cur[j] = v
      best = Math.min(best, v)
    }
    if (best > max) return max + 1
    prev2.length = 0
    prev2.push(...prev)
    prev = cur
  }
  return prev[b.length]!
}

/* ------------------------------ price in words ---------------------------- */

const AMOUNT = String.raw`₦?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?`
const toNaira = (n: string, unit?: string) => {
  const v = parseFloat(n.replace(/,/g, ''))
  if (!isFinite(v)) return undefined
  return Math.round(unit === 'k' || unit === 'thousand' ? v * 1_000 : unit === 'm' || unit === 'million' ? v * 1_000_000 : v)
}

export function extractPrice(raw: string): { text: string; min?: number; max?: number } {
  let text = raw.toLowerCase()
  let min: number | undefined, max: number | undefined
  const between = new RegExp(String.raw`between\s*${AMOUNT}\s*(?:and|to|-)\s*${AMOUNT}`)
  const bm = text.match(between)
  if (bm) {
    // "200 and 500k" reads as 200k to 500k
    const hi = toNaira(bm[3]!, bm[4]), lo = toNaira(bm[1]!, bm[2] ?? bm[4])
    min = lo; max = hi; text = text.replace(between, ' ')
  }
  const under = new RegExp(String.raw`(?:under|below|less than|cheaper than|up to|max(?:imum)?|within)\s*${AMOUNT}`)
  const um = text.match(under)
  if (um) { max = toNaira(um[1]!, um[2]); text = text.replace(under, ' ') }
  const over = new RegExp(String.raw`(?:over|above|more than|from|min(?:imum)?|at least)\s*${AMOUNT}`)
  const om = text.match(over)
  if (om) { min = toNaira(om[1]!, om[2]); text = text.replace(over, ' ') }
  return { text, min, max }
}

/* ------------------------------ indexing --------------------------------- */

interface Doc {
  name: string[]
  type: string[]
  room: string[]
  material: string[]
  maker: string[]
  detail: string[]
}
const WEIGHT: Record<keyof Doc, number> = { name: 10, type: 6, room: 5, material: 4, maker: 3, detail: 2 }
const FIELDS = Object.keys(WEIGHT) as (keyof Doc)[]

const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id
const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? id

const cache = new WeakMap<Product, Doc>()
function docOf(p: Product): Doc {
  let d = cache.get(p)
  if (!d) {
    d = {
      name: tokens(p.name),
      type: tokens(`${categoryName(p.categoryId)} ${p.categoryId}`),
      room: tokens(`${roomName(p.room)} ${p.room}`),
      material: tokens(p.material),
      maker: tokens(p.vendor.name),
      detail: tokens(`${p.description ?? ''} ${(p.colors ?? []).map((c) => c.name).join(' ')}`),
    }
    cache.set(p, d)
  }
  return d
}

/** How well one word (with its synonyms) matches a list of words: 1 exact, .75 starts-with, .5 a typo away, 0 none. */
function matchWord(alts: string[], words: string[]): number {
  let best = 0
  for (const w of words) {
    for (const a of alts) {
      if (w === a) return 1
      // Half-typed words: "wardrob" → wardrobe. A short word must be most of the longer one ("bed" is not "bedroom").
      if (a.length >= 3 && w.startsWith(a) && a.length / w.length >= 0.6) best = Math.max(best, 0.75)
      else if (a.length >= 4 && w.length >= 4) {
        // A typo. Four-letter words must keep their first and last letter ("sofa" is not "soft").
        if (a.length === 4 && (a[0] !== w[0] || a[3] !== w[w.length - 1])) continue
        const allowed = a.length >= 8 ? 2 : 1
        if (editDistance(a, w, allowed) <= allowed) best = Math.max(best, 0.5)
      }
    }
  }
  return best
}

const altsFor = (term: string) => [...new Set([term, ...(ALTS.get(term) ?? []).map(stem)])]

function scoreProduct(p: Product, termAlts: string[][]): { score: number; matched: number } {
  const d = docOf(p)
  let score = 0, matched = 0
  for (const alts of termAlts) {
    let best = 0
    for (const f of FIELDS) best = Math.max(best, WEIGHT[f] * matchWord(alts, d[f]))
    if (best > 0) { matched++; score += best }
  }
  return { score, matched }
}

/** Every distinct word in the catalogue, for "did you mean". */
function vocabulary(products: Product[]): string[] {
  const v = new Set<string>()
  for (const p of products) { const d = docOf(p); for (const f of FIELDS) for (const w of d[f]) if (w.length >= 3) v.add(w) }
  for (const g of GROUPS) for (const w of g) v.add(stem(w))
  return [...v]
}

/* -------------------------------- search --------------------------------- */

export function search(all: Product[], f: SearchFilters): SearchResult {
  const price = extractPrice(f.q)
  const terms = tokens(price.text).filter((t) => !STOP.has(t))
  const min = f.min ?? price.min
  const max = f.max ?? price.max

  const passes = (p: Product) =>
    (!f.room || p.room === f.room) && (!f.category || p.categoryId === f.category) && (!f.inStock || p.inStock) &&
    (min === undefined || p.price >= min) && (max === undefined || p.price <= max)

  const pool = all.filter(passes)
  const sorter = (a: { p: Product; score: number }, b: { p: Product; score: number }) =>
    b.score - a.score || Number(b.p.inStock) - Number(a.p.inStock) || b.p.rating - a.p.rating || a.p.price - b.p.price
  const finish = (rows: { p: Product; score: number }[]) => applySort(rows.sort(sorter).map((r) => r.p), f.sort)

  if (terms.length === 0) {
    return { products: finish(pool.map((p) => ({ p, score: p.inStock ? 1 : 0 }))), mode: 'all', terms, priceFromText: { min: price.min, max: price.max } }
  }

  const termAlts = terms.map(altsFor)
  const phrase = terms.join(' ')
  const scored = pool.map((p) => {
    const s = scoreProduct(p, termAlts)
    const bonus = normalise(p.name).includes(phrase) ? 8 : 0
    return { p, matched: s.matched, score: s.score + bonus + (p.inStock ? 1 : 0) + p.rating * 0.2 }
  })

  const exact = scored.filter((r) => r.matched === terms.length)
  if (exact.length > 0) return { products: finish(exact), mode: 'exact', terms, priceFromText: { min: price.min, max: price.max } }

  const related = scored.filter((r) => r.matched > 0).map((r) => ({ p: r.p, score: r.score + r.matched * 20 }))
  const didYouMean = suggestSpelling(all, terms)
  if (related.length > 0) return { products: finish(related), mode: 'related', terms, priceFromText: { min: price.min, max: price.max }, didYouMean }
  return { products: [], mode: 'none', terms, priceFromText: { min: price.min, max: price.max }, didYouMean }
}

function applySort(list: Product[], sort: Sort = 'relevance'): Product[] {
  if (sort === 'price-asc') return [...list].sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') return [...list].sort((a, b) => b.price - a.price)
  if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
  return list
}

function suggestSpelling(all: Product[], terms: string[]): string | undefined {
  const vocab = vocabulary(all)
  let changed = false
  const fixed = terms.map((t) => {
    if (t.length < 4 || vocab.includes(t)) return t
    let best: { w: string; d: number } | undefined
    for (const w of vocab) {
      const d = editDistance(t, w, 2)
      if (d <= 2 && (!best || d < best.d)) best = { w, d }
    }
    if (best) { changed = true; return best.w }
    return t
  })
  return changed ? fixed.join(' ') : undefined
}

/* ------------------------------- facets ---------------------------------- */

export interface Facets {
  rooms: { id: string; name: string; count: number }[]
  categories: { id: string; name: string; count: number }[]
  priceMin: number
  priceMax: number
}

/** Counts for the filter chips, based on what the words alone would find (so chips never say 0 by surprise). */
export function facets(all: Product[], q: string): Facets {
  const base = search(all, { q }).products
  const tally = (key: 'room' | 'categoryId', name: (id: string) => string) => {
    const m = new Map<string, number>()
    for (const p of base) m.set(p[key], (m.get(p[key]) ?? 0) + 1)
    return [...m].map(([id, count]) => ({ id, name: name(id), count })).sort((a, b) => b.count - a.count)
  }
  const prices = base.map((p) => p.price)
  return { rooms: tally('room', roomName), categories: tally('categoryId', categoryName), priceMin: prices.length ? Math.min(...prices) : 0, priceMax: prices.length ? Math.max(...prices) : 0 }
}

/* ------------------------------ autocomplete ----------------------------- */

export interface Suggestions {
  products: Product[]
  categories: { id: string; name: string }[]
  rooms: { id: string; name: string }[]
}

export function suggest(all: Product[], raw: string, limit = 5): Suggestions {
  const q = raw.trim()
  if (q.length < 2) return { products: [], categories: [], rooms: [] }
  const r = search(all, { q })
  const top = r.products.slice(0, limit)
  const count = (key: 'room' | 'categoryId') => {
    const m = new Map<string, number>()
    for (const p of r.products) m.set(p[key], (m.get(p[key]) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id)
  }
  return {
    products: top,
    categories: count('categoryId').map((id) => ({ id, name: categoryName(id) })),
    rooms: count('room').map((id) => ({ id, name: roomName(id) })),
  }
}

/* ------------------------------ helpers for UI --------------------------- */

export const PRICE_BANDS = [
  { id: 'u100', label: 'Under ₦100,000', max: 100_000 },
  { id: '100-300', label: '₦100,000 – ₦300,000', min: 100_000, max: 300_000 },
  { id: '300-600', label: '₦300,000 – ₦600,000', min: 300_000, max: 600_000 },
  { id: 'o600', label: 'Over ₦600,000', min: 600_000 },
] as const

export const formatNairaShort = (n: number) => (n >= 1_000_000 ? `₦${+(n / 1_000_000).toFixed(1)}m` : n >= 1_000 ? `₦${Math.round(n / 1_000)}k` : `₦${n}`)

export const POPULAR_SEARCHES = ['Sofa', 'Dining table', 'Bed frame', 'Wardrobe', 'Floor lamp', 'Office desk']

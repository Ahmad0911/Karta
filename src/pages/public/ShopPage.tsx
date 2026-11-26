import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'

import { categories } from '@/data/categories'
import { rooms } from '@/data/rooms'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { formatNaira } from '@/lib/format'
import ProductCard from '@/modules/catalog/components/ProductCard'
import { PRICE_BANDS, POPULAR_SEARCHES, facets as buildFacets, search, type Sort } from '@/modules/catalog/search'
import { useCatalog } from '@/modules/catalog/useCatalog'

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
    on
      ? 'border-[#151b1c] bg-[#151b1c] text-white shadow-[0_5px_18px_rgba(21,27,28,0.12)]'
      : 'border-[#151b1c]/10 bg-white/50 text-[#151b1c]/50 hover:border-[#151b1c]/25 hover:bg-white hover:text-[#151b1c]'
  }`

const selectClass =
  'h-10 w-full appearance-none rounded-full border border-[#151b1c]/10 bg-white/70 pl-4 pr-9 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#151b1c]/65 outline-none transition-all duration-300 hover:border-[#151b1c]/25 focus:border-[#8f7651]/50'

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined)

export default function ShopPage() {
  const { products, status } = useCatalog() as ReturnType<typeof useCatalog> & { status?: string }
  useDocumentTitle('Shop the collection')

  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  // Everything lives in the address bar, so any view can be shared, bookmarked and reached by the back button.
  const q = params.get('q') ?? ''
  const room = params.get('room') ?? undefined
  const category = params.get('category') ?? undefined
  const min = num(params.get('min'))
  const max = num(params.get('max'))
  const inStock = params.get('stock') === '1'
  const sort = (['price-asc', 'price-desc', 'rating'].includes(params.get('sort') ?? '') ? params.get('sort') : 'relevance') as Sort

  const result = useMemo(
    () => search(products, { q, room, category, min, max, inStock, sort }),
    [products, q, room, category, min, max, inStock, sort],
  )
  const facet = useMemo(() => buildFacets(products, q), [products, q])
  const list = result.products

  const set = (patch: Record<string, string | undefined>, replace = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v === undefined || v === '' ? next.delete(k) : next.set(k, v))
    setParams(next, { replace })
  }
  const clearAll = () => setParams(new URLSearchParams())

  // The price the person typed in words ("under 300k") is shown as a removable chip too.
  const textMax = max === undefined ? result.priceFromText.max : undefined
  const textMin = min === undefined ? result.priceFromText.min : undefined
  const band = PRICE_BANDS.find((b) => (b as { min?: number }).min === min && (b as { max?: number }).max === max)

  const active: { key: string; label: string; remove: () => void }[] = [
    ...(room ? [{ key: 'room', label: rooms.find((r) => r.id === room)?.name ?? room, remove: () => set({ room: undefined }) }] : []),
    ...(category ? [{ key: 'category', label: categories.find((c) => c.id === category)?.name ?? category, remove: () => set({ category: undefined }) }] : []),
    ...(min !== undefined || max !== undefined
      ? [{ key: 'price', label: band?.label ?? `${min !== undefined ? formatNaira(min) : '₦0'} – ${max !== undefined ? formatNaira(max) : 'any'}`, remove: () => set({ min: undefined, max: undefined }) }]
      : []),
    ...(inStock ? [{ key: 'stock', label: 'In stock', remove: () => set({ stock: undefined }) }] : []),
  ]

  const loading = status === 'idle' || status === 'loading'
  const filtered = active.length > 0 || q !== ''

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f6f1] text-[#151b1c]">
      {/* ---------------------------------------------------------------- */}
      {/* Header + search                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#b79a6b]/[0.07] blur-3xl" />
        <div className="container-x relative pb-8 pt-12 sm:pb-10 sm:pt-16 lg:pt-20">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#b79a6b]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8f7651]">The Karta Collection</p>
          </div>

          <h1 className="mt-6 max-w-4xl font-display text-[2.6rem] font-medium leading-[1] tracking-[-0.04em] sm:text-6xl lg:text-[4.6rem]">
            {q ? (<>Pieces matching <span className="text-[#8f7651]">“{q}”</span></>) : (<>Objects for <br /><span className="text-[#8f7651]">beautiful living.</span></>)}
          </h1>

          <div className="mt-8 max-w-xl">
            <div className="group relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#151b1c]/30 transition-colors group-focus-within:text-[#8f7651]" />
              <input
                value={q}
                aria-label="Search the collection"
                placeholder="Try “sofa”, “oak bed” or “table under 300k”"
                className="h-14 w-full rounded-full border border-[#151b1c]/10 bg-white/75 pl-13 pr-12 text-sm outline-none backdrop-blur-md transition-all duration-300 placeholder:text-[#151b1c]/30 hover:border-[#151b1c]/20 focus:border-[#8f7651]/50 focus:bg-white focus:shadow-[0_15px_40px_rgba(21,27,28,0.06)]"
                onChange={(e) => set({ q: e.target.value }, true)}
              />
              {q && (
                <button type="button" aria-label="Clear search" onClick={() => set({ q: undefined }, true)} className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#151b1c]/35 hover:bg-[#151b1c]/[0.06] hover:text-[#151b1c]">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Filter bar                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="sticky top-0 z-20 border-y border-[#151b1c]/[0.07] bg-[#f8f6f1]/92 backdrop-blur-xl">
        <div className="container-x">
          <div className="flex flex-col gap-3 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button type="button" onClick={() => set({ room: undefined })} className={chip(!room)}>All</button>
                {rooms.map((r) => {
                  const n = facet.rooms.find((f) => f.id === r.id)?.count
                  return (
                    <button key={r.id} type="button" onClick={() => set({ room: r.id })} className={chip(room === r.id)}>
                      {r.name}{q && n !== undefined ? <span className="ml-1.5 opacity-50">{n}</span> : null}
                    </button>
                  )
                })}
              </div>

              <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#151b1c]/10 bg-white/70 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#151b1c]/65 hover:border-[#151b1c]/25">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters{active.length > 0 && <span className="rounded-full bg-[#151b1c] px-1.5 text-[10px] text-white">{active.length}</span>}
              </button>
            </div>

            {showFilters && (
              <div className="grid gap-3 rounded-2xl border border-[#151b1c]/[0.07] bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="relative block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/40">Type</span>
                  <select value={category ?? ''} onChange={(e) => set({ category: e.target.value })} className={selectClass}>
                    <option value="">All types</option>
                    {categories.map((c) => { const n = facet.categories.find((f) => f.id === c.id)?.count; return <option key={c.id} value={c.id}>{c.name}{q && n !== undefined ? ` (${n})` : ''}</option> })}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 text-[#151b1c]/35" />
                </label>

                <label className="relative block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/40">Price</span>
                  <select
                    value={band?.id ?? ''}
                    onChange={(e) => { const b = PRICE_BANDS.find((x) => x.id === e.target.value) as { min?: number; max?: number } | undefined; set({ min: b?.min?.toString(), max: b?.max?.toString() }) }}
                    className={selectClass}
                  >
                    <option value="">Any price</option>
                    {PRICE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 text-[#151b1c]/35" />
                </label>

                <label className="relative block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/40">Sort by</span>
                  <select value={sort} onChange={(e) => set({ sort: e.target.value === 'relevance' ? undefined : e.target.value })} className={selectClass}>
                    <option value="relevance">Best match</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="rating">Highest rated</option>
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 text-[#151b1c]/35" />
                </label>

                <div className="flex items-end">
                  <label className="flex h-10 cursor-pointer items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#151b1c]/65">
                    <input type="checkbox" checked={inStock} onChange={(e) => set({ stock: e.target.checked ? '1' : undefined })} className="h-4 w-4 accent-[#151b1c]" />
                    In stock only
                  </label>
                </div>
              </div>
            )}

            {(active.length > 0 || textMax !== undefined || textMin !== undefined) && (
              <div className="flex flex-wrap items-center gap-2">
                {active.map((a) => (
                  <button key={a.key} type="button" onClick={a.remove} className="inline-flex items-center gap-1.5 rounded-full border border-[#151b1c]/10 bg-white px-3 py-1.5 text-[11px] font-medium text-[#151b1c]/70 hover:border-[#151b1c]/25">
                    {a.label}<X className="h-3 w-3" aria-label={`Remove ${a.label}`} />
                  </button>
                ))}
                {(textMax !== undefined || textMin !== undefined) && (
                  <span className="inline-flex items-center rounded-full bg-[#b79a6b]/15 px-3 py-1.5 text-[11px] font-medium text-[#8f7651]">
                    {textMin !== undefined && textMax !== undefined ? `${formatNaira(textMin)} – ${formatNaira(textMax)}` : textMax !== undefined ? `Under ${formatNaira(textMax)}` : `Over ${formatNaira(textMin!)}`}
                  </span>
                )}
                {active.length > 0 && <button type="button" onClick={() => set({ room: undefined, category: undefined, min: undefined, max: undefined, stock: undefined })} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8f7651] underline-offset-4 hover:underline">Clear filters</button>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Results                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-x py-10 sm:py-14">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3" aria-live="polite">
          <p className="text-sm text-[#151b1c]/55">
            <span className="font-semibold text-[#151b1c]">{list.length}</span> {list.length === 1 ? 'piece' : 'pieces'}
            {q && result.mode !== 'none' && <> for “{q}”</>}
          </p>
          <div className="hidden items-center gap-2 text-[11px] sm:flex">
            <span className="uppercase tracking-[0.16em] text-[#151b1c]/35">Sort</span>
            {([['relevance', 'Best match'], ['price-asc', 'Price ↑'], ['price-desc', 'Price ↓'], ['rating', 'Top rated']] as [Sort, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => set({ sort: id === 'relevance' ? undefined : id })} className={`rounded-full px-3 py-1.5 font-medium ${sort === id ? 'bg-[#151b1c] text-white' : 'text-[#151b1c]/55 hover:bg-[#151b1c]/[0.05]'}`}>{label}</button>
            ))}
          </div>
        </div>

        {result.mode === 'related' && (
          <div className="mb-8 rounded-2xl border border-[#b79a6b]/30 bg-[#b79a6b]/[0.07] px-5 py-4 text-sm text-[#151b1c]/75">
            We couldn’t find a piece that matches <strong>every</strong> word in “{q}”, so here are the closest ones.
            {result.didYouMean && <> Did you mean <button type="button" onClick={() => set({ q: result.didYouMean }, true)} className="font-semibold text-[#8f7651] underline underline-offset-4">{result.didYouMean}</button>?</>}
          </div>
        )}

        {loading && list.length === 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}><div className="aspect-[4/5] animate-pulse rounded-2xl bg-[#151b1c]/[0.06]" /><div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-[#151b1c]/[0.06]" /><div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[#151b1c]/[0.06]" /></div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="mx-auto flex min-h-[380px] max-w-xl flex-col items-center justify-center rounded-[2rem] border border-[#151b1c]/[0.07] bg-white/45 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#b79a6b]/30 bg-[#b79a6b]/[0.06]"><Search className="h-5 w-5 text-[#8f7651]" /></span>
            <p className="mt-6 font-display text-3xl tracking-tight">{filtered ? 'Nothing matches that.' : 'No pieces yet.'}</p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#151b1c]/50">
              {filtered ? 'Check the spelling, remove a filter, or try one of these.' : 'New pieces from our verified makers will appear here very soon.'}
            </p>
            {result.didYouMean && <p className="mt-4 text-sm">Did you mean <button type="button" onClick={() => set({ q: result.didYouMean }, true)} className="font-semibold text-[#8f7651] underline underline-offset-4">{result.didYouMean}</button>?</p>}
            {filtered && (
              <>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {POPULAR_SEARCHES.map((p) => <button key={p} type="button" onClick={() => setParams(new URLSearchParams({ q: p }))} className="rounded-full border border-[#151b1c]/10 bg-white px-4 py-2 text-xs font-medium text-[#151b1c]/70 hover:border-[#151b1c]/25">{p}</button>)}
                </div>
                <button type="button" onClick={clearAll} className="mt-7 inline-flex h-11 items-center rounded-full bg-[#151b1c] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#243033]">Clear search and filters</button>
              </>
            )}
            <Link to="/request" className="mt-5 text-xs text-[#151b1c]/55 underline underline-offset-4 hover:text-[#151b1c]">Can’t find it? Request a custom piece</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-16">
            {list.map((product, index) => (
              <div key={product.id} className="animate-[fadeIn_500ms_ease-out_both]" style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react'

import { rooms } from '@/data/rooms'
import { useCatalog } from '@/modules/catalog/useCatalog'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import ProductCard from '@/modules/catalog/components/ProductCard'

type Sort = 'relevance' | 'price-asc' | 'price-desc' | 'rating'

export default function ShopPage() {
  const { products } = useCatalog()
  useDocumentTitle('Shop the collection')

  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState<Sort>('relevance')

  const cat = params.get('room') ?? 'all'
  const q = (params.get('q') ?? '').trim().toLowerCase()

  const list = useMemo(() => {
    const filtered = products.filter(
      (product) =>
        (cat === 'all' || product.room === cat) &&
        (!q ||
          `${product.name} ${product.vendor.name} ${product.material}`
            .toLowerCase()
            .includes(q)),
    )

    if (sort === 'price-asc') {
      return [...filtered].sort((a, b) => a.price - b.price)
    }

    if (sort === 'price-desc') {
      return [...filtered].sort((a, b) => b.price - a.price)
    }

    if (sort === 'rating') {
      return [...filtered].sort((a, b) => b.rating - a.rating)
    }

    return filtered
  }, [products, cat, q, sort])

  const setCat = (id: string) => {
    const next = new URLSearchParams(params)

    if (id === 'all') {
      next.delete('room')
    } else {
      next.set('room', id)
    }

    setParams(next)
  }

  const clearSearch = () => {
    const next = new URLSearchParams(params)
    next.delete('q')
    setParams(next, { replace: true })
  }

  const activeRoom =
    cat === 'all' ? 'All pieces' : rooms.find((room) => room.id === cat)?.name

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f6f1] text-[#151b1c]">
      {/* ================================================================ */}
      {/* Collection Header                                                */}
      {/* ================================================================ */}

      <section className="relative">
        {/* Ambient luxury lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#b79a6b]/[0.07] blur-3xl"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#151b1c]/[0.025] blur-3xl"
        />

        <div className="container-x relative pb-10 pt-12 sm:pb-14 sm:pt-16 lg:pb-16 lg:pt-20">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#b79a6b]" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8f7651]">
              The Karta Collection
            </p>
          </div>

          {/* Heading */}
          <div className="mt-6 max-w-4xl">
            <h1 className="font-display text-[3rem] font-medium leading-[0.98] tracking-[-0.045em] text-[#151b1c] sm:text-6xl lg:text-[5.2rem]">
              {q ? (
                <>
                  Pieces matching{' '}
                  <span className="text-[#8f7651]">“{q}”</span>
                </>
              ) : (
                <>
                  Objects for
                  <br />
                  <span className="text-[#8f7651]">beautiful living.</span>
                </>
              )}
            </h1>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#151b1c]/50 sm:text-base">
            A considered collection of furniture designed to bring warmth,
            character and quiet sophistication into the spaces you inhabit.
          </p>

          {/* ============================================================ */}
          {/* Search                                                        */}
          {/* ============================================================ */}

          <div className="mt-9 max-w-xl">
            <div className="group relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#151b1c]/30 transition-colors duration-300 group-focus-within:text-[#8f7651]"
              />

              <input
                value={params.get('q') ?? ''}
                aria-label="Search the collection"
                placeholder="Search furniture, materials or makers"
                className="h-14 w-full rounded-full border border-[#151b1c]/10 bg-white/75 pl-13 pr-12 text-sm text-[#151b1c] outline-none backdrop-blur-md transition-all duration-300 placeholder:text-[#151b1c]/30 hover:border-[#151b1c]/20 focus:border-[#8f7651]/50 focus:bg-white focus:shadow-[0_15px_40px_rgba(21,27,28,0.06)]"
                onChange={(event) => {
                  const next = new URLSearchParams(params)

                  if (event.target.value) {
                    next.set('q', event.target.value)
                  } else {
                    next.delete('q')
                  }

                  setParams(next, { replace: true })
                }}
              />

              {q && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#151b1c]/35 transition-all duration-300 hover:bg-[#151b1c]/[0.06] hover:text-[#151b1c]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Filter / Sort Bar                                                 */}
      {/* ================================================================ */}

      <section className="sticky top-0 z-20 border-y border-[#151b1c]/[0.07] bg-[#f8f6f1]/90 backdrop-blur-xl">
        <div className="container-x">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Categories */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/35 sm:flex">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Browse
              </div>

              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setCat('all')}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
                    cat === 'all'
                      ? 'border-[#151b1c] bg-[#151b1c] text-white shadow-[0_5px_18px_rgba(21,27,28,0.12)]'
                      : 'border-[#151b1c]/10 bg-white/50 text-[#151b1c]/50 hover:border-[#151b1c]/25 hover:bg-white hover:text-[#151b1c]'
                  }`}
                >
                  All
                </button>

                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setCat(room.id)}
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
                      cat === room.id
                        ? 'border-[#151b1c] bg-[#151b1c] text-white shadow-[0_5px_18px_rgba(21,27,28,0.12)]'
                        : 'border-[#151b1c]/10 bg-white/50 text-[#151b1c]/50 hover:border-[#151b1c]/25 hover:bg-white hover:text-[#151b1c]'
                    }`}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Results + Sort */}
            <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#151b1c]/35">
                <span className="font-semibold text-[#151b1c]/65">
                  {list.length}
                </span>{' '}
                {list.length === 1 ? 'piece' : 'pieces'}
              </p>

              <div className="relative">
                <select
                  value={sort}
                  aria-label="Sort collection"
                  onChange={(event) =>
                    setSort(event.target.value as Sort)
                  }
                  className="h-10 appearance-none rounded-full border border-[#151b1c]/10 bg-white/70 pl-4 pr-10 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#151b1c]/65 outline-none transition-all duration-300 hover:border-[#151b1c]/25 focus:border-[#8f7651]/50"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="rating">Highest rated</option>
                </select>

                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#151b1c]/35"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Collection Grid                                                   */}
      {/* ================================================================ */}

      <section className="container-x py-10 sm:py-14 lg:py-16">
        {/* Active collection indicator */}
        <div className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8f7651]">
              Curated selection
            </p>

            <p className="mt-1 text-sm text-[#151b1c]/45">
              {activeRoom}
              {q && (
                <>
                  {' '}
                  · Search results
                </>
              )}
            </p>
          </div>

          <span className="hidden h-px w-20 bg-[#b79a6b]/40 sm:block" />
        </div>

        {list.length === 0 ? (
          /* ============================================================ */
          /* Empty State                                                  */
          /* ============================================================ */

          <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-[#151b1c]/[0.07] bg-white/45 px-6 text-center">
            <div className="max-w-md">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#b79a6b]/30 bg-[#b79a6b]/[0.06]">
                <Search className="h-5 w-5 text-[#8f7651]" />
              </span>

              <p className="mt-6 font-display text-3xl tracking-tight text-[#151b1c]">
                Nothing found.
              </p>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#151b1c]/45">
                We couldn't find a piece matching your current search or
                category. Try exploring another part of the collection.
              </p>

              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams()
                  setParams(next)
                }}
                className="mt-7 inline-flex h-11 items-center rounded-full bg-[#151b1c] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#243033] hover:shadow-[0_12px_30px_rgba(21,27,28,0.16)]"
              >
                View all pieces
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* Products                                                     */
          /* ============================================================ */

          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-16">
            {list.map((product, index) => (
              <div
                key={product.id}
                className="animate-[fadeIn_500ms_ease-out_both]"
                style={{
                  animationDelay: `${Math.min(index * 45, 360)}ms`,
                }}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* Bottom Editorial Detail                                          */}
      {/* ================================================================ */}

      {list.length > 0 && (
        <section className="border-t border-[#151b1c]/[0.06] bg-[#eeebe4]">
          <div className="container-x py-14 sm:py-20">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">
                  Karta / Objects
                </p>

                <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight tracking-[-0.025em] text-[#151b1c] sm:text-4xl">
                  Chosen for spaces that deserve to be remembered.
                </h2>
              </div>

              <p className="max-w-sm text-xs leading-6 text-[#151b1c]/45">
                Discover considered pieces from makers selected for their
                craftsmanship, materiality and enduring character.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
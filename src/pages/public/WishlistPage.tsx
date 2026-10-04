
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Heart,
  Sparkles,
  ShoppingBag,
} from 'lucide-react'

import { useCatalog } from '@/modules/catalog/useCatalog'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useCartStore } from '@/store/cart.store'
import ProductCard from '@/modules/catalog/components/ProductCard'

export default function WishlistPage() {
  const { getProduct } = useCatalog()
  useDocumentTitle('Your wishlist')

  const wishlist = useCartStore((s) => s.wishlist)

  const pieces = wishlist.flatMap((id) => {
    const product = getProduct(id)
    return product ? [product] : []
  })

  return (
    <div className="overflow-hidden bg-[#f8f6f1] text-[#151b1c]">
      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="relative">
        {/* Architectural background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-[#8f7651]/[0.09]" />
          <div className="absolute -right-16 -top-16 h-[25rem] w-[25rem] rounded-full border border-[#8f7651]/[0.07]" />
          <div className="absolute right-20 top-20 h-2 w-2 rounded-full bg-[#8f7651]/50" />

          <div className="absolute inset-y-0 left-[8%] w-px bg-[#151b1c]/[0.035]" />
          <div className="absolute inset-y-0 right-[8%] w-px bg-[#151b1c]/[0.035]" />
        </div>

        <div className="container-x relative pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_300px] lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-9 bg-[#8f7651]" />

                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#8f7651]">
                  Personal collection
                </p>
              </div>

              <h1 className="mt-7 max-w-4xl font-display text-[3.4rem] font-medium leading-[0.93] tracking-[-0.055em] sm:text-[4.8rem] lg:text-[5.8rem]">
                Pieces worth
                <br />
                <span className="text-[#8f7651]">remembering.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-[15px] leading-8 text-[#151b1c]/60 sm:text-base">
                Keep the pieces that caught your eye close at hand. Your Karta
                wishlist is a private edit of furniture and objects you may
                want to bring into your space.
              </p>
            </div>

            <div className="hidden lg:block">
              <div className="border-l border-[#151b1c]/10 pl-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#8f7651]/20 bg-[#8f7651]/[0.06]">
                  <Heart className="h-4 w-4 text-[#8f7651]" />
                </div>

                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/35">
                  Your edit
                </p>

                <p className="mt-2 font-display text-xl leading-tight">
                  Considered pieces,
                  <br />
                  saved for later.
                </p>
              </div>
            </div>
          </div>

          {/* Collection metadata */}
          <div className="mt-12 grid max-w-3xl grid-cols-2 border-y border-[#151b1c]/[0.08] sm:grid-cols-3">
            <div className="border-r border-[#151b1c]/[0.08] py-5 pr-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/35">
                Saved pieces
              </p>

              <p className="mt-2 font-display text-2xl tracking-[-0.02em]">
                {pieces.length}
              </p>
            </div>

            <div className="border-r border-[#151b1c]/[0.08] px-5 py-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/35">
                Collection
              </p>

              <p className="mt-2 font-display text-2xl tracking-[-0.02em]">
                Karta
              </p>
            </div>

            <div className="hidden py-5 pl-5 sm:block">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/35">
                Status
              </p>

              <p className="mt-2 font-display text-2xl tracking-[-0.02em]">
                Private
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          COLLECTION
      ================================================================ */}
      <section className="container-x pb-20 sm:pb-28">
        {pieces.length === 0 ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-[#151b1c]/[0.08] bg-white/60 px-6 py-20 text-center shadow-[0_24px_70px_rgba(21,27,28,0.045)] sm:px-10 sm:py-28">
            {/* Decorative geometry */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full border border-[#8f7651]/[0.10]" />
            <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full border border-[#151b1c]/[0.05]" />

            <div className="relative mx-auto max-w-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#8f7651]/25 bg-[#8f7651]/[0.06]">
                <Heart className="h-6 w-6 text-[#8f7651]" />
              </div>

              <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">
                Your collection is waiting
              </p>

              <h2 className="mt-4 font-display text-3xl tracking-[-0.035em] sm:text-4xl">
                Nothing saved yet.
              </h2>

              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#151b1c]/50">
                When a piece speaks to you, tap the heart to keep it in your
                personal Karta collection. Return whenever you are ready.
              </p>

              <Link
                to="/shop"
                className="group mt-8 inline-flex h-13 items-center gap-3 rounded-full bg-[#151b1c] px-7 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253033]"
              >
                Explore the collection

                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <div className="mt-10 flex items-center justify-center gap-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/30">
                <Sparkles className="h-3.5 w-3.5 text-[#8f7651]" />
                Curated for considered living
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Collection heading */}
            <div className="mb-9 flex flex-wrap items-end justify-between gap-5 border-b border-[#151b1c]/[0.08] pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-px w-7 bg-[#8f7651]" />

                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">
                    Saved collection
                  </p>
                </div>

                <h2 className="mt-3 font-display text-2xl tracking-[-0.025em] sm:text-3xl">
                  Your selected pieces
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#151b1c]/[0.08] bg-white/60">
                  <Heart className="h-4 w-4 text-[#8f7651]" />
                </span>

                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#151b1c]/40">
                  <span className="font-semibold text-[#151b1c]/70">
                    {pieces.length}
                  </span>{' '}
                  {pieces.length === 1 ? 'piece' : 'pieces'}
                </p>
              </div>
            </div>

            {/* Products */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-5 sm:gap-y-14 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-16">
              {pieces.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ================================================================
          CLOSING BRAND PANEL
      ================================================================ */}
      {pieces.length > 0 && (
        <section className="container-x pb-20 sm:pb-28">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-[#151b1c] px-7 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
            <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-[#d6bd91]/[0.10]" />
            <div className="pointer-events-none absolute -right-6 top-10 h-2 w-2 rounded-full bg-[#d6bd91]/60" />

            <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-[#d6bd91]" />

                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#d6bd91]">
                    Continue exploring
                  </p>
                </div>

                <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
                  Your collection can always grow.
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-7 text-white/50">
                  Discover more furniture, objects and considered pieces for
                  the spaces you are creating.
                </p>
              </div>

              <Link
                to="/shop"
                className="group inline-flex h-12 w-fit items-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-[#151b1c] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f3eee5]"
              >
                Continue shopping
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="relative mt-8 flex items-center gap-2 border-t border-white/[0.08] pt-5">
              <ShoppingBag className="h-3.5 w-3.5 text-[#d6bd91]" />

              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/30">
                Furniture · Interiors · Living
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
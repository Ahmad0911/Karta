import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Heart,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react'

import { useCatalog } from '@/modules/catalog/useCatalog'
import { formatNaira } from '@/lib/format'
import { SITE } from '@/config/site'
import { useCartStore } from '@/store/cart.store'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { whatsappEnabled, whatsappLink } from '@/lib/whatsapp'

import SafeImage from '@/components/ui/SafeImage'
import TrustBadge from '@/modules/vendors/components/TrustBadge'

export default function ProductPage() {
  const { getProduct } = useCatalog()
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const product = getProduct(id)

  useDocumentTitle(product?.name ?? 'Piece not found')

  const [qty, setQty] = useState(1)
  const [assembly, setAssembly] = useState(false)

  const add = useCartStore((state) => state.add)
  const wished = useCartStore((state) => state.wishlist.includes(id))
  const toggleWishlist = useCartStore((state) => state.toggleWishlist)

  if (!product) {
    return (
      <section className="container-x flex min-h-[70vh] items-center justify-center py-20">
        <div className="max-w-md text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink/40">
            Karta
          </span>

          <h1 className="mt-5 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            Piece not found
          </h1>

          <p className="mt-4 text-sm leading-7 text-ink/55">
            The piece you're looking for may have been removed, sold, or is no
            longer available in our collection.
          </p>

          <Link
            to="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#101E21] px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1a2b2f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to collection
          </Link>
        </div>
      </section>
    )
  }

  const assemblyFee = assembly ? SITE.assemblyFee : 0
  const total = (product.price + assemblyFee) * qty

  return (
    <main className="bg-[#f8f7f4]">
      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumb                                                          */}
      {/* ------------------------------------------------------------------ */}

      <div className="container-x pt-6 sm:pt-8">
        <Link
          to={`/shop?room=${product.room}`}
          className="group inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/45 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to collection
        </Link>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Product                                                             */}
      {/* ------------------------------------------------------------------ */}

      <section className="container-x grid gap-10 py-8 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(400px,0.85fr)] lg:gap-16 lg:py-14 xl:gap-24">
        {/* ================================================================ */}
        {/* Product imagery                                                   */}
        {/* ================================================================ */}

        <div className="relative">
          <div className="group relative overflow-hidden rounded-[2rem] bg-[#ebe8e1] shadow-[0_25px_70px_rgba(16,30,33,0.08)]">
            <SafeImage
              src={product.image}
              alt={product.name}
              fallback={`bg-gradient-to-br ${product.swatch}`}
              className="aspect-[4/5] w-full transition-transform duration-700 ease-out group-hover:scale-[1.025]"
            />

            {/* Image overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/15 to-transparent opacity-60" />

            {/* Product status */}
            {product.tag && (
              <div className="absolute left-5 top-5">
                <span className="inline-flex items-center rounded-full border border-white/40 bg-white/90 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#101E21] shadow-sm backdrop-blur-md">
                  {product.tag}
                </span>
              </div>
            )}

            {/* Floating wishlist */}
            <button
              type="button"
              aria-label="Add to wishlist"
              aria-pressed={wished}
              onClick={() => toggleWishlist(product.id)}
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/90 text-[#101E21] shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105"
            >
              <Heart
                className={`h-[18px] w-[18px] transition-all ${
                  wished
                    ? 'fill-red-600 text-red-600'
                    : 'text-[#101E21]'
                }`}
              />
            </button>
          </div>

          {/* Image caption */}
          <div className="mt-4 flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/35">
              Karta Collection
            </p>

            <p className="text-[10px] uppercase tracking-[0.16em] text-ink/35">
              Curated piece
            </p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Product information                                               */}
        {/* ================================================================ */}

        <div className="lg:pt-3">
          {/* Category */}
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brass-700">
            {product.room} collection
          </p>

          {/* Title */}
          <h1 className="mt-4 max-w-2xl font-display text-[2.5rem] font-medium leading-[1.05] tracking-[-0.035em] text-[#101E21] sm:text-5xl xl:text-[3.65rem]">
            {product.name}
          </h1>

          {/* Vendor */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <TrustBadge
              vendorName={product.vendor.name}
              score={product.vendor.trustScore}
            />

            <span className="h-1 w-1 rounded-full bg-ink/20" />

            <Link
              to={`/vendors/${product.vendor.id}`}
              className="text-xs text-ink/55 underline underline-offset-4 hover:text-ink"
            >
              {product.reviewCount > 0
                ? `★ ${product.rating.toFixed(1)} · ${product.reviewCount} verified review${product.reviewCount === 1 ? '' : 's'}`
                : 'New to Karta · view vendor'}
            </Link>
          </div>

          {/* Price */}
          <div className="mt-8 flex flex-wrap items-end gap-3 border-b border-ink/10 pb-8">
            <span className="font-display text-3xl font-semibold tracking-tight text-[#101E21] sm:text-4xl">
              {formatNaira(product.price)}
            </span>

            {product.originalPrice && (
              <span className="pb-1 text-sm text-ink/30 line-through">
                {formatNaira(product.originalPrice)}
              </span>
            )}

            {product.originalPrice && (
              <span className="mb-1 rounded-full bg-[#101E21]/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#101E21]/60">
                Special price
              </span>
            )}
          </div>

          {/* ============================================================ */}
          {/* Product specifications                                       */}
          {/* ============================================================ */}

          <div className="border-b border-ink/10 py-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink/35">
              Details
            </p>

            <dl className="mt-5 space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-4 text-sm">
                <dt className="text-ink/40">Material</dt>
                <dd className="leading-6 text-ink/80">
                  {product.material}
                </dd>
              </div>

              <div className="grid grid-cols-[100px_1fr] gap-4 text-sm">
                <dt className="text-ink/40">Dimensions</dt>
                <dd className="text-ink/80">{product.dimensions}</dd>
              </div>

              <div className="grid grid-cols-[100px_1fr] gap-4 text-sm">
                <dt className="text-ink/40">Delivery</dt>

                <dd className="flex items-center gap-2 text-ink/80">
                  <Truck className="h-4 w-4 text-brass-700" />

                  {product.deliveryEstimateDays[0]}–
                  {product.deliveryEstimateDays[1]} days
                </dd>
              </div>

              <div className="grid grid-cols-[100px_1fr] gap-4 text-sm">
                <dt className="text-ink/40">Availability</dt>

                <dd
                  className={
                    product.inStock
                      ? 'font-medium text-emerald-700'
                      : 'font-medium text-ink/45'
                  }
                >
                  {product.inStock ? 'Available to order' : 'Currently unavailable'}
                </dd>
              </div>
            </dl>
          </div>

          {/* ============================================================ */}
          {/* Colour selection                                              */}
          {/* ============================================================ */}

          {product.colors?.length ? (
            <div className="border-b border-ink/10 py-7">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink/35">
                  Available finishes
                </p>

                <span className="text-xs text-ink/40">
                  {product.colors.length} options
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    title={color.name}
                    className="group flex items-center gap-2.5 rounded-full border border-ink/10 bg-white px-3 py-2 transition-all duration-300 hover:border-ink/25 hover:shadow-sm"
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: color.hex }}
                    />

                    <span className="text-xs font-medium text-ink/65">
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* Assembly                                                       */}
          {/* ============================================================ */}

          {product.assemblyAvailable && (
            <label
              className={`mt-7 flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all duration-300 ${
                assembly
                  ? 'border-[#101E21]/20 bg-white shadow-[0_10px_30px_rgba(16,30,33,0.05)]'
                  : 'border-ink/10 bg-white/60 hover:border-ink/20'
              }`}
            >
              <input
                type="checkbox"
                checked={assembly}
                onChange={(event) => setAssembly(event.target.checked)}
                className="sr-only"
              />

              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                  assembly
                    ? 'border-[#101E21] bg-[#101E21] text-white'
                    : 'border-ink/20 bg-white'
                }`}
              >
                {assembly && <Check className="h-3 w-3" />}
              </span>

              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#101E21]">
                  <Wrench className="h-4 w-4 text-brass-700" />
                  Professional assembly
                </span>

                <span className="mt-1 block text-xs leading-5 text-ink/45">
                  Have your piece professionally assembled on delivery.
                </span>
              </span>

              <span className="text-xs font-semibold text-ink/60">
                +{formatNaira(SITE.assemblyFee)}
              </span>
            </label>
          )}

          {/* ============================================================ */}
          {/* Purchase controls                                             */}
          {/* ============================================================ */}

          <div className="mt-7 rounded-[1.5rem] border border-ink/10 bg-white p-4 shadow-[0_15px_45px_rgba(16,30,33,0.045)]">
            <div className="flex gap-3">
              {/* Quantity */}
              <div className="flex h-14 items-center rounded-full border border-ink/10 bg-[#f8f7f4]">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="flex h-full w-11 items-center justify-center text-lg text-ink/60 transition-colors hover:text-ink"
                >
                  −
                </button>

                <span className="w-7 text-center text-sm font-semibold text-[#101E21]">
                  {qty}
                </span>

                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty(qty + 1)}
                  className="flex h-full w-11 items-center justify-center text-lg text-ink/60 transition-colors hover:text-ink"
                >
                  +
                </button>
              </div>

              {/* Add to cart */}
              <button
                type="button"
                disabled={!product.inStock}
                onClick={() => {
                  add(product.id, qty, assembly)
                  navigate('/cart')
                }}
                className="flex h-14 flex-1 items-center justify-center rounded-full bg-[#101E21] px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1b3034] hover:shadow-[0_12px_30px_rgba(16,30,33,0.18)] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:shadow-none"
              >
                {product.inStock
                  ? `Add to cart · ${formatNaira(total)}`
                  : 'Currently unavailable'}
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Trust / protection                                            */}
          {/* ============================================================ */}

          <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
            <div className="bg-white px-4 py-4">
              <ShieldCheck className="h-4 w-4 text-brass-700" />

              <p className="mt-2 text-[11px] font-semibold text-[#101E21]">
                Karta Protected
              </p>

              <p className="mt-1 text-[10px] leading-4 text-ink/40">
                Secure purchase protection
              </p>
            </div>

            <div className="bg-white px-4 py-4">
              <Truck className="h-4 w-4 text-brass-700" />

              <p className="mt-2 text-[11px] font-semibold text-[#101E21]">
                Delivered with care
              </p>

              <p className="mt-1 text-[10px] leading-4 text-ink/40">
                Carefully coordinated delivery
              </p>
            </div>

            <div className="bg-white px-4 py-4">
              <Check className="h-4 w-4 text-brass-700" />

              <p className="mt-2 text-[11px] font-semibold text-[#101E21]">
                Verified seller
              </p>

              <p className="mt-1 text-[10px] leading-4 text-ink/40">
                Trusted marketplace partner
              </p>
            </div>
          </div>

          {/* WhatsApp */}
          {whatsappEnabled && (
            <a
              href={whatsappLink(
                `Hello Karta, I'd like to ask about ${product.name} (${window.location.href})`,
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-ink/55 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-[#101E21]"
            >
              Have a question about this piece?
              <span>Ask us on WhatsApp</span>
            </a>
          )}
        </div>
      </section>
    </main>
  )
}
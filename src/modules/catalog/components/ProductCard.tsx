
import { Link } from 'react-router-dom';
import { Heart, Star, Truck, Wrench, ArrowUpRight } from 'lucide-react';
import type { Product } from '@/types';
import { formatNaira } from '@/lib/format';
import { useCartStore } from '@/store/cart.store';
import SafeImage from '@/components/ui/SafeImage';
import TrustBadge from '@/modules/vendors/components/TrustBadge';

export default function ProductCard({ product: p }: { product: Product }) {
  const wished = useCartStore((s) => s.wishlist.includes(p.id));
  const toggleWishlist = useCartStore((s) => s.toggleWishlist);
  const add = useCartStore((s) => s.add);

  const discount = p.originalPrice
    ? Math.round((1 - p.price / p.originalPrice) * 100)
    : null;

  return (
    <article
      className="
        group relative flex h-full flex-col overflow-hidden
        rounded-[1.75rem]
        border border-[#101E21]/[0.08]
        bg-white
        shadow-[0_8px_35px_rgba(16,30,33,0.035)]
        transition-all duration-700 ease-out
        hover:-translate-y-1.5
        hover:border-[#101E21]/[0.14]
        hover:shadow-[0_30px_80px_-32px_rgba(16,30,33,0.28)]
      "
    >
      {/* ================================================================ */}
      {/* Product imagery                                                  */}
      {/* ================================================================ */}

      <div className="relative overflow-hidden bg-[#ebe8e1]">
        <Link
          to={`/product/${p.id}`}
          aria-label={p.name}
          className="relative block overflow-hidden"
        >
          <SafeImage
            src={p.image}
            alt={p.name}
            fallback={`bg-gradient-to-br ${p.swatch}`}
            className="
              aspect-[4/3]
              w-full
              object-cover
              transition-transform
              duration-[1200ms]
              ease-[cubic-bezier(0.22,1,0.36,1)]
              group-hover:scale-[1.045]
            "
          />

          {/* Refined image vignette */}
          <div
            className="
              pointer-events-none absolute inset-0
              bg-gradient-to-t
              from-[#101E21]/[0.14]
              via-transparent
              to-white/[0.04]
              opacity-60
              transition-opacity duration-700
              group-hover:opacity-80
            "
          />

          {/* Subtle editorial shine */}
          <div
            className="
              pointer-events-none absolute inset-0
              -translate-x-full
              bg-gradient-to-r
              from-transparent
              via-white/[0.12]
              to-transparent
              transition-transform duration-[1200ms]
              ease-out
              group-hover:translate-x-full
            "
          />
        </Link>

        {/* ============================================================ */}
        {/* Collection / status tag                                      */}
        {/* ============================================================ */}

        {p.tag && (
          <div className="absolute left-5 top-5">
            <span
              className="
                inline-flex items-center
                rounded-full
                border border-white/30
                bg-[#101E21]/[0.88]
                px-3.5 py-2
                text-[9px]
                font-bold
                uppercase
                tracking-[0.2em]
                text-white
                shadow-[0_8px_25px_rgba(0,0,0,0.12)]
                backdrop-blur-md
              "
            >
              {p.tag}
            </span>
          </div>
        )}

        {/* ============================================================ */}
        {/* Wishlist                                                       */}
        {/* ============================================================ */}

        <button
          type="button"
          aria-pressed={wished}
          aria-label={
            wished ? 'Remove from wishlist' : 'Add to wishlist'
          }
          onClick={() => toggleWishlist(p.id)}
          className="
            absolute right-5 top-5
            flex h-10 w-10
            items-center justify-center
            rounded-full
            border border-white/50
            bg-white/[0.90]
            text-[#101E21]
            shadow-[0_8px_25px_rgba(16,30,33,0.10)]
            backdrop-blur-xl
            transition-all duration-500
            hover:scale-105
            hover:bg-white
            active:scale-95
          "
        >
          <Heart
            className={`
              h-[16px] w-[16px]
              transition-all duration-300
              ${
                wished
                  ? 'fill-[#9b302d] text-[#9b302d]'
                  : 'text-[#101E21]/55 group-hover:text-[#101E21]'
              }
            `}
          />
        </button>

        {/* ============================================================ */}
        {/* Discount                                                       */}
        {/* ============================================================ */}

        {discount !== null && (
          <div className="absolute bottom-4 left-5">
            <span
              className="
                inline-flex items-center
                rounded-full
                border border-white/40
                bg-white/[0.92]
                px-3 py-1.5
                text-[9px]
                font-bold
                uppercase
                tracking-[0.16em]
                text-[#101E21]
                shadow-sm
                backdrop-blur-md
              "
            >
              {discount}% advantage
            </span>
          </div>
        )}

        {/* ============================================================ */}
        {/* Out of stock                                                   */}
        {/* ============================================================ */}

        {!p.inStock && (
          <div
            className="
              pointer-events-none absolute inset-0
              flex items-center justify-center
              bg-[#101E21]/55
              backdrop-blur-[2px]
            "
          >
            <span
              className="
                rounded-full
                border border-white/30
                bg-white/[0.94]
                px-5 py-2.5
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-[#101E21]
                shadow-xl
              "
            >
              Currently unavailable
            </span>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Product information                                              */}
      {/* ================================================================ */}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* Collection label */}
        <div className="flex items-center justify-between gap-3">
          <span
            className="
              text-[9px]
              font-bold
              uppercase
              tracking-[0.22em]
              text-[#9a7338]
            "
          >
            Curated piece
          </span>

          <Link
            to={`/product/${p.id}`}
            aria-label={`View ${p.name}`}
            className="
              flex h-7 w-7
              items-center justify-center
              rounded-full
              border border-[#101E21]/[0.08]
              text-[#101E21]/40
              transition-all duration-300
              hover:border-[#101E21]/20
              hover:bg-[#101E21]
              hover:text-white
            "
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Product name */}
        <Link to={`/product/${p.id}`}>
          <h3
            className="
              mt-3
              line-clamp-2
              min-h-[3.15rem]
              font-display
              text-[1.08rem]
              font-medium
              leading-[1.42]
              tracking-[-0.015em]
              text-[#101E21]
              transition-colors duration-300
              group-hover:text-[#8a642f]
            "
          >
            {p.name}
          </h3>
        </Link>

        {/* Vendor */}
        <div className="mt-3">
          <TrustBadge
            vendorName={p.vendor.name}
            score={p.vendor.trustScore}
            compact
          />
        </div>

        {/* ============================================================ */}
        {/* Rating                                                        */}
        {/* ============================================================ */}

        <div
          className="
            mt-3
            flex items-center gap-2
            text-[10px]
            text-[#101E21]/40
          "
        >
          {p.reviewCount > 0 ? (
            <>
              <span className="flex items-center gap-1">
                <Star aria-hidden="true" className="h-3 w-3 fill-[#b08a4a] text-[#b08a4a]" />

                <span className="font-semibold text-[#101E21]/75">
                  {p.rating.toFixed(1)}
                </span>
              </span>

              <span className="h-1 w-1 rounded-full bg-[#101E21]/20" />

              <span>
                {p.reviewCount} vendor review{p.reviewCount === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <span>New to Karta</span>
          )}
        </div>

        {/* ============================================================ */}
        {/* Pricing                                                       */}
        {/* ============================================================ */}

        <div
          className="
            mt-5
            flex flex-wrap items-end gap-x-2.5 gap-y-1
          "
        >
          <span
            className="
              font-display
              text-[1.65rem]
              font-semibold
              leading-none
              tracking-[-0.025em]
              text-[#101E21]
            "
          >
            {formatNaira(p.price)}
          </span>

          {p.originalPrice && (
            <>
              <span
                className="
                  pb-0.5
                  text-xs
                  text-[#101E21]/30
                  line-through
                "
              >
                {formatNaira(p.originalPrice)}
              </span>

              <span
                className="
                  mb-0.5
                  rounded-full
                  bg-[#9a7338]/[0.09]
                  px-2
                  py-1
                  text-[8px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[#8a642f]
                "
              >
                {discount}% off
              </span>
            </>
          )}
        </div>

        {/* ============================================================ */}
        {/* Logistics                                                     */}
        {/* ============================================================ */}

        <div
          className="
            mt-5
            space-y-2
            border-t
            border-[#101E21]/[0.08]
            pt-4
            text-[10px]
            leading-5
            text-[#101E21]/50
          "
        >
          <p className="flex items-center gap-2.5">
            <span
              className="
                flex h-6 w-6
                shrink-0
                items-center justify-center
                rounded-full
                bg-[#f5f2eb]
              "
            >
              <Truck className="h-3 w-3 text-[#9a7338]" />
            </span>

            <span>
              {p.deliveryEstimateDays[0]}–
              {p.deliveryEstimateDays[1]} days estimated delivery
            </span>
          </p>

          {p.assemblyAvailable && (
            <p className="flex items-center gap-2.5">
              <span
                className="
                  flex h-6 w-6
                  shrink-0
                  items-center justify-center
                  rounded-full
                  bg-[#f5f2eb]
                "
              >
                <Wrench className="h-3 w-3 text-[#9a7338]" />
              </span>

              <span>Professional assembly available</span>
            </p>
          )}
        </div>

        {/* ============================================================ */}
        {/* Purchase                                                       */}
        {/* ============================================================ */}

        <div className="mt-auto pt-6">
          <button
            type="button"
            disabled={!p.inStock}
            onClick={() => add(p.id)}
            className="
              relative
              flex h-12
              w-full
              items-center
              justify-center
              overflow-hidden
              rounded-full
              bg-[#101E21]
              px-5
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-white
              shadow-[0_10px_30px_rgba(16,30,33,0.12)]
              transition-all duration-500
              hover:-translate-y-0.5
              hover:bg-[#182b2f]
              hover:shadow-[0_16px_35px_rgba(16,30,33,0.18)]
              active:translate-y-0
              disabled:cursor-not-allowed
              disabled:bg-[#101E21]/15
              disabled:text-[#101E21]/40
              disabled:shadow-none
            "
          >
            {/* Button shine */}
            <span
              className="
                pointer-events-none absolute inset-y-0 -left-1/2
                w-1/3
                skew-x-[-20deg]
                bg-white/[0.08]
                transition-transform duration-700
                group-hover:translate-x-[500%]
              "
            />

            <span className="relative">
              {p.inStock ? 'Add to collection' : 'Out of stock'}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
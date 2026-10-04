
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useCatalog } from '@/modules/catalog/useCatalog';
import ProductCard from '@/modules/catalog/components/ProductCard';

export default function FeaturedCollection() {
  const { products } = useCatalog();
  return (
    <section
      className="
        relative overflow-hidden
        border-b border-[#101E21]/[0.08]
        bg-white
        py-20 sm:py-28
      "
    >
      <div className="container-x">
        {/* ============================================================ */}
        {/* Collection heading                                             */}
        {/* ============================================================ */}

        <div
          className="
            flex flex-col gap-8
            lg:flex-row
            lg:items-end
            lg:justify-between
          "
        >
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#9a7338]" />

              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.3em]
                  text-[#9a7338]
                "
              >
                The Karta collection
              </p>
            </div>

            {/* Heading */}
            <h2
              className="
                mt-5
                max-w-2xl
                font-display
                text-[2.65rem]
                font-medium
                leading-[1.03]
                tracking-[-0.04em]
                text-[#101E21]
                sm:text-5xl
                lg:text-[4rem]
              "
            >
              Pieces worth
              <span className="block italic text-[#101E21]/70">
                making room for.
              </span>
            </h2>

            {/* Supporting copy */}
            <p
              className="
                mt-5
                max-w-xl
                text-sm
                leading-7
                text-[#101E21]/48
                sm:text-[0.95rem]
              "
            >
              A considered selection of furniture and objects chosen for
              enduring character, exceptional craft and the spaces they
              help create.
            </p>
          </div>

          {/* ========================================================== */}
          {/* View all                                                     */}
          {/* ========================================================== */}

          <Link
            to="/shop"
            className="
              group
              inline-flex
              w-fit
              shrink-0
              items-center
              gap-3
              border-b
              border-[#101E21]/20
              pb-2.5
              text-[10px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-[#101E21]/65
              transition-all
              duration-300
              hover:border-[#9a7338]
              hover:text-[#9a7338]
            "
          >
            Explore the collection

            <ArrowUpRight
              className="
                h-3.5 w-3.5
                transition-transform
                duration-300
                group-hover:translate-x-0.5
                group-hover:-translate-y-0.5
              "
            />
          </Link>
        </div>

        {/* ============================================================ */}
        {/* Collection divider                                            */}
        {/* ============================================================ */}

        <div className="mt-10 flex items-center gap-4 sm:mt-14">
          <span className="text-[8px] font-semibold uppercase tracking-[0.25em] text-[#101E21]/25">
            Selected pieces
          </span>

          <span className="h-px flex-1 bg-[#101E21]/[0.07]" />

          <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#101E21]/25">
            01 — 04
          </span>
        </div>

        {/* ============================================================ */}
        {/* Product collection                                            */}
        {/* ============================================================ */}

        <div
          className="
            mt-7
            grid
            grid-cols-2
            gap-x-3
            gap-y-7
            sm:gap-x-5
            sm:gap-y-10
            lg:grid-cols-4
          "
        >
          {products.slice(0, 4).map((p, index) => (
            <div key={p.id} className="relative">
              {/* Editorial index */}
              <span
                className="
                  pointer-events-none
                  absolute
                  -top-5
                  left-1
                  z-10
                  text-[8px]
                  font-semibold
                  tracking-[0.2em]
                  text-[#101E21]/25
                "
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <ProductCard product={p} />
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* Bottom collection statement                                   */}
        {/* ============================================================ */}

        <div
          className="
            mt-14
            flex
            flex-col
            items-start
            gap-5
            border-t
            border-[#101E21]/[0.08]
            pt-8
            sm:mt-16
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p
            className="
              max-w-lg
              text-[11px]
              leading-6
              text-[#101E21]/40
            "
          >
            Designed to live beautifully. Discover the full Karta collection
            for pieces selected with intention.
          </p>

          <Link
            to="/shop"
            className="
              group
              inline-flex
              items-center
              gap-2
              text-[9px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-[#101E21]/60
              transition-colors
              duration-300
              hover:text-[#9a7338]
            "
          >
            View all pieces

            <ArrowUpRight
              className="
                h-3.5 w-3.5
                transition-transform
                duration-300
                group-hover:translate-x-0.5
                group-hover:-translate-y-0.5
              "
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

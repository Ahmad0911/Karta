
import {
<<<<<<< HEAD
  ArrowLeft,
=======
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
  ArrowUpRight,
  Compass,
  Home,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-[#f7f4ee] text-[#151b1c]">
      {/* ================================================================
          ARCHITECTURAL BACKGROUND
      ================================================================ */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Warm ambient light */}
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#b79a6b]/[0.08] blur-3xl" />

        <div className="absolute -bottom-48 -left-40 h-[30rem] w-[30rem] rounded-full bg-white/80 blur-3xl" />

        {/* Architectural circles */}
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-[#151b1c]/[0.055]" />

        <div className="absolute -right-24 -top-24 h-[25rem] w-[25rem] rounded-full border border-[#151b1c]/[0.045]" />

        <div className="absolute -right-8 -top-8 h-[16rem] w-[16rem] rounded-full border border-[#151b1c]/[0.035]" />

        {/* Architectural grid */}
        <div className="absolute left-[7%] top-0 h-full w-px bg-[#151b1c]/[0.035]" />

        <div className="absolute right-[7%] top-0 h-full w-px bg-[#151b1c]/[0.035]" />

        <div className="absolute left-0 right-0 top-[18%] h-px bg-[#151b1c]/[0.03]" />

        <div className="absolute bottom-[14%] left-0 right-0 h-px bg-[#151b1c]/[0.035]" />

        {/* Small architectural marker */}
        <div className="absolute left-[7%] top-[18%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b79a6b] bg-[#f7f4ee]" />
      </div>

      <div className="container-x relative flex min-h-[calc(100vh-5rem)] items-center py-20 sm:py-24">
        <div className="w-full">
          {/* ============================================================
              EYEBROW
          ============================================================ */}
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-[#b79a6b]" />

            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#8f7651] sm:text-[10px]">
              Karta · Page Not Found
            </p>
          </div>

          {/* ============================================================
              MAIN CONTENT
          ============================================================ */}
          <div className="relative mt-10 sm:mt-12">
            {/* Large 404 */}
            <div
              aria-hidden="true"
              className="select-none font-display text-[clamp(8rem,21vw,18rem)] font-light leading-[0.65] tracking-[-0.09em] text-[#151b1c]/[0.055]"
            >
              404
            </div>

            {/* Content overlay */}
            <div className="relative -mt-5 ml-1 max-w-3xl sm:-mt-12 lg:-mt-16">
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b79a6b]" />

                <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#151b1c]/35">
                  Lost in the collection
                </span>
              </div>

              <h1 className="mt-5 font-display text-[2.9rem] font-medium leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-[5.7rem]">
                This room
                <br />
                <span className="font-light italic text-[#8f7651]">
                  doesn’t exist.
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-sm leading-7 text-[#151b1c]/50 sm:text-[15px] sm:leading-8">
                The page you were looking for may have moved, been removed,
                or never existed. Let’s get you back to the Karta collection.
              </p>

              {/* ========================================================
                  ACTIONS
              ======================================================== */}
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[#151b1c] px-7 text-[10px] font-semibold uppercase tracking-[0.17em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#252d2e] hover:shadow-[0_18px_40px_rgba(21,27,28,0.16)] sm:h-13"
                >
                  <Home
                    size={14}
                    strokeWidth={1.7}
                    className="transition-transform duration-300 group-hover:-translate-x-0.5"
                  />

                  Back to Karta
                </Link>

                <Link
                  to="/products"
                  className="group inline-flex h-12 items-center justify-center gap-3 rounded-full border border-[#151b1c]/10 bg-white/60 px-7 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#151b1c]/65 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#151b1c]/20 hover:bg-white hover:text-[#151b1c] hover:shadow-[0_14px_35px_rgba(21,27,28,0.06)] sm:h-13"
                >
                  <Search
                    size={14}
                    strokeWidth={1.7}
                  />

                  Explore collection

                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.7}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              {/* Small navigation hint */}
              <Link
                to="/"
                className="group mt-7 inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/30 transition-colors duration-300 hover:text-[#8f7651]"
              >
                <Compass className="h-3.5 w-3.5" />

                Return to the beginning

                <ArrowRightSmall />
              </Link>
            </div>
          </div>

          {/* ============================================================
              BRAND SIGNATURE
          ============================================================ */}
          <div className="mt-20 flex flex-col gap-4 border-t border-[#151b1c]/[0.08] pt-5 sm:mt-24 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="font-display text-sm tracking-[0.12em] text-[#151b1c]/70">
                KARTA
              </span>

              <span className="h-px w-8 bg-[#151b1c]/15" />

              <span className="text-[8px] uppercase tracking-[0.28em] text-[#151b1c]/30 sm:text-[9px]">
                Furniture · Interiors · Living
              </span>
            </div>

            <span className="text-[8px] uppercase tracking-[0.2em] text-[#151b1c]/25 sm:text-[9px]">
              Designed for considered living
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * Small inline arrow used for the understated secondary navigation cue.
 * Keeping this as a component prevents the main JSX from becoming noisy.
 */
function ArrowRightSmall() {
  return (
    <span
      aria-hidden="true"
      className="inline-block transition-transform duration-300 group-hover:translate-x-1"
    >
      →
    </span>
  )
}
import Hero from '@/modules/marketing/components/Hero'
import CategoryShowcase from '@/modules/marketing/components/CategoryShowcase'
import FeaturedCollection from '@/modules/marketing/components/FeaturedCollection'
import PromiseSection from '@/modules/marketing/components/PromiseSection'
import VendorStrip from '@/modules/marketing/components/VendorStrip'
import RecommendedVendors from '@/modules/marketing/components/RecommendedVendors'
import CustomRequestBand from '@/modules/marketing/components/CustomRequestBand'

import { useDocumentTitle } from '@/lib/useDocumentTitle'

/**
 * Storefront landing page.
 *
 * Section order: Hero → Rooms → Featured pieces → Customer journey →
 * Vendor invitation. Each section owns its own background, so this page only
 * adds a few atmospheric details and the dividers between sections.
 */
export default function HomePage() {
  useDocumentTitle()

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f6f1] text-[#151b1c] selection:bg-[#b79a6b]/20 selection:text-[#151b1c]">
      {/* ------------------------------------------------------------------ */}
      {/* Hero: immersive brand introduction                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_20%,rgba(183,154,107,0.10),transparent_32%),radial-gradient(circle_at_15%_75%,rgba(16,30,33,0.045),transparent_30%)]"
        />

        <Hero />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Rooms: browse by space                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-t border-[#151b1c]/[0.06] bg-[#f8f6f1]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-px w-24 -translate-x-1/2 bg-[#b79a6b]/45"
        />

        <CategoryShowcase />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Featured collection: statement pieces                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-[#eeebe4]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-1/2 h-[32rem] w-[32rem] -translate-y-1/2 rounded-full bg-[#b79a6b]/[0.045] blur-3xl"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-[#151b1c]/[0.025] blur-3xl"
        />

        <div className="relative">
          <FeaturedCollection />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Custom requests: "can't find it? ask for it"                        */}
      {/* ------------------------------------------------------------------ */}
      <CustomRequestBand />

      {/* ------------------------------------------------------------------ */}
      {/* Recommended vendors (only appears once reviews have earned it)      */}
      {/* ------------------------------------------------------------------ */}
      <RecommendedVendors />

      {/* ------------------------------------------------------------------ */}
      {/* Customer journey (renders its own section and background)           */}
      {/* ------------------------------------------------------------------ */}
      <PromiseSection />

      {/* ------------------------------------------------------------------ */}
      {/* Vendor invitation (renders its own section and background)          */}
      {/* ------------------------------------------------------------------ */}
      <VendorStrip />

      {/* Breathing room so the dark vendor block doesn't merge into the footer. */}
      <div aria-hidden="true" className="h-8 bg-[#f8f6f1] sm:h-12 lg:h-16" />
    </main>
  )
}

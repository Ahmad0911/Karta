
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'

import { COMPANY } from '@/config/company'
import { mailtoLink } from '@/lib/contact'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'

const BENEFITS = [
  {
    number: '01',
    icon: Sparkles,
    title: 'A storefront your work deserves',
    body: 'Present your furniture through a refined Karta storefront designed to give exceptional pieces the attention they deserve.',
  },
  {
    number: '02',
    icon: Truck,
    title: 'Delivery coordinated with you',
    body: 'Orders move from your workshop to the customer with delivery coordination, tracking and proof of delivery built into the experience.',
  },
  {
    number: '03',
    icon: CircleDollarSign,
    title: 'Clear orders and settlements',
    body: 'Manage products, stock and orders in one place while keeping visibility over your earnings, settlements and payment status.',
  },
  {
    number: '04',
    icon: ShieldCheck,
    title: 'Trust that helps you sell',
    body: 'Verification and vendor trust signals give customers greater confidence when choosing who to buy from.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Apply',
    body: 'Create your account and introduce us to your business, workshop and the kind of pieces you create.',
  },
  {
    number: '02',
    title: 'Get verified',
    body: 'Our team reviews your business information and work before your storefront becomes available to customers.',
  },
  {
    number: '03',
    title: 'List your collection',
    body: 'Add considered photography, dimensions, materials, pricing and realistic delivery expectations.',
  },
  {
    number: '04',
    title: 'Sell & grow',
    body: 'Fulfil orders through Karta, deliver exceptional service and receive your settlements.',
  },
] as const

const secondaryButton =
  'inline-flex h-12 items-center justify-center rounded-full border border-[#151b1c]/10 bg-white/60 px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#151b1c]/70 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#151b1c]/20 hover:bg-white hover:text-[#151b1c] hover:shadow-[0_14px_35px_rgba(21,27,28,0.06)]'

export default function BecomeVendorPage() {
  useDocumentTitle('Sell on Karta')

  const user = useAuthStore((s) => s.user)

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#151b1c]">
      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="relative overflow-hidden border-b border-[#151b1c]/[0.07]">
        {/* Ambient luxury lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-[#b79a6b]/[0.10] blur-3xl"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-[-12rem] h-[34rem] w-[34rem] rounded-full bg-white/80 blur-3xl"
        />

        <div className="container-x relative pb-20 pt-14 sm:pb-28 sm:pt-20 lg:pb-32 lg:pt-24">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[#b79a6b]" />

            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#8f7651] sm:text-[10px]">
              Karta Vendor Collection
            </p>
          </div>

          <div className="mt-7 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:gap-20">
            <div className="max-w-4xl">
              <h1 className="font-display text-[3.15rem] font-medium leading-[0.92] tracking-[-0.06em] sm:text-6xl lg:text-[5.7rem]">
                Your craft deserves
                <br />
                <span className="text-[#8f7651]">a better stage.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-[15px] leading-8 text-[#151b1c]/55 sm:text-base">
                Karta is a curated furniture marketplace connecting
                independent makers, established businesses and discerning
                customers looking for pieces worth bringing home.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={user ? '/vendor' : '/register?as=vendor'}
                  className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[#151b1c] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#252d2e] hover:shadow-[0_18px_40px_rgba(21,27,28,0.16)]"
                >
                  {user ? 'Open vendor portal' : 'Apply to sell'}

                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>

                {!user && (
                  <Link
                    to="/login"
                    state={{ from: '/vendor' }}
                    className={secondaryButton}
                  >
                    I already have a vendor account
                  </Link>
                )}
              </div>
            </div>

            {/* Hero side statement */}
            <div className="hidden border-l border-[#151b1c]/10 pl-7 lg:block">
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#8f7651]">
                Built for makers
              </p>

              <p className="mt-4 font-display text-2xl leading-[1.15] tracking-[-0.025em]">
                Put your work in front of customers who care about what they
                buy.
              </p>

              <p className="mt-4 text-sm leading-6 text-[#151b1c]/45">
                From presentation to fulfilment, Karta brings the experience
                together.
              </p>
            </div>
          </div>

          {/* Premium trust strip */}
          <div className="mt-14 overflow-hidden rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-[#151b1c] shadow-[0_24px_65px_rgba(21,27,28,0.12)]">
            <div className="grid sm:grid-cols-3">
              <div className="flex items-center gap-4 px-6 py-5">
                <BadgeCheck className="h-5 w-5 shrink-0 text-[#d6bd91]" />

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Curated
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Verified vendors
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0">
                <Boxes className="h-5 w-5 shrink-0 text-[#d6bd91]" />

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Commerce
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Products & orders
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0">
                <CircleDollarSign className="h-5 w-5 shrink-0 text-[#d6bd91]" />

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Settlements
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Clear payment visibility
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          BENEFITS
      ================================================================ */}
      <section className="container-x py-20 sm:py-28 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
              The Karta advantage
            </p>

            <h2 className="mt-3 max-w-md font-display text-4xl leading-[1] tracking-[-0.045em] sm:text-5xl">
              More than a storefront.
            </h2>

            <p className="mt-5 max-w-sm text-sm leading-7 text-[#151b1c]/50">
              We are building the infrastructure around the sale of good
              furniture — not simply another place to upload products.
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {BENEFITS.map(
              ({ number, icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="group border-t border-[#151b1c]/10 pt-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#151b1c]/[0.07] bg-white/60 transition-all duration-300 group-hover:border-[#b79a6b]/30 group-hover:bg-[#b79a6b]/10">
                      <Icon className="h-4 w-4 text-[#8f7651]" />
                    </span>

                    <span className="font-display text-sm text-[#151b1c]/25">
                      {number}
                    </span>
                  </div>

                  <h3 className="mt-7 font-display text-xl tracking-[-0.02em]">
                    {title}
                  </h3>

                  <p className="mt-3 text-[14px] leading-7 text-[#151b1c]/55">
                    {body}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          PROCESS
      ================================================================ */}
      <section className="relative overflow-hidden border-y border-[#151b1c]/[0.07] bg-[#eae5db]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-white/50 blur-3xl"
        />

        <div className="container-x relative py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
              The process
            </p>

            <h2 className="mt-3 font-display text-4xl leading-[1] tracking-[-0.045em] sm:text-5xl">
              From application
              <br />
              to your first order.
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-7 text-[#151b1c]/50">
              We keep the process straightforward while maintaining the level
              of verification customers expect from a curated marketplace.
            </p>
          </div>

          <ol className="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-[#151b1c]/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ number, title, body }) => (
              <li
                key={title}
                className="bg-[#f3f0e9] p-6 transition-colors duration-300 hover:bg-white sm:p-7"
              >
                <span className="font-display text-2xl text-[#8f7651]">
                  {number}
                </span>

                <h3 className="mt-8 font-display text-xl tracking-[-0.02em]">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-[#151b1c]/50">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================================================================
          VENDOR STANDARD
      ================================================================ */}
      <section className="container-x py-20 sm:py-28 lg:py-32">
        <div className="overflow-hidden rounded-[1.75rem] bg-[#151b1c] text-white shadow-[0_30px_80px_rgba(21,27,28,0.14)]">
          <div className="relative px-7 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#b79a6b]/10 blur-3xl"
            />

            <div className="relative grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-20">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#d6bd91]">
                  Our standard
                </p>

                <h2 className="mt-4 max-w-2xl font-display text-4xl leading-[0.98] tracking-[-0.045em] sm:text-5xl">
                  Good furniture should be presented with the same care it
                  took to make it.
                </h2>
              </div>

              <div>
                <p className="text-sm leading-7 text-white/50">
                  We look for businesses and makers who care about materials,
                  construction, presentation, customer experience and
                  dependable fulfilment.
                </p>

                <div className="mt-7 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6bd91]">
                  <span className="h-px w-8 bg-[#b79a6b]" />
                  Built for quality
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          QUESTIONS / CTA
      ================================================================ */}
      <section className="border-t border-[#151b1c]/[0.07]">
        <div className="container-x py-20 sm:py-28 lg:py-32">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
                Vendor enquiries
              </p>

              <h2 className="mt-3 font-display text-4xl leading-[1] tracking-[-0.045em] sm:text-5xl">
                Have questions
                <br />
                before you apply?
              </h2>

              <p className="mt-5 max-w-xl text-[15px] leading-8 text-[#151b1c]/50">
                Speak with our vendor team about categories, onboarding,
                marketplace requirements, fees or what we look for in a
                partner.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                href={mailtoLink({
                  to: COMPANY.vendorEmail,
                  subject: 'Vendor enquiry',
                })}
                className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[#151b1c] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#252d2e] hover:shadow-[0_18px_40px_rgba(21,27,28,0.14)]"
              >
                Email the vendor team
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>

              <Link
                to="/contact?topic=vendor"
                className={secondaryButton}
              >
                Send a message
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA
      ================================================================ */}
      <section className="container-x pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[#151b1c]/[0.08] bg-[#ded6c7] px-7 py-12 sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/50 blur-3xl"
          />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
                Join Karta
              </p>

              <h2 className="mt-3 font-display text-3xl leading-[1] tracking-[-0.04em] sm:text-4xl">
                Ready to put your work
                <br />
                in front of the right customer?
              </h2>
            </div>

            <Link
              to={user ? '/vendor' : '/register?as=vendor'}
              className="group inline-flex h-12 w-fit shrink-0 items-center justify-center gap-3 rounded-full bg-[#151b1c] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#252d2e] hover:shadow-[0_18px_40px_rgba(21,27,28,0.16)]"
            >
              {user ? 'Open vendor portal' : 'Apply to sell'}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  LifeBuoy,
  PackageSearch,
  Shield,
  Sparkles,
  Store,
  Truck,
  Undo2,
} from 'lucide-react'

import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'
import { useCartStore } from '@/store/cart.store'

type AccountCard = {
  to: string
  icon: typeof Store
  title: string
  body: string
  eyebrow: string
  featured?: boolean
}

export default function AccountHomePage() {
  useDocumentTitle('My Account | Karta')

  const wishCount = useCartStore((s) => s.wishlist.length)
  const user = useAuthStore((s) => s.user)
  const role = user?.role

  const firstName = user?.name?.trim()
    ? user.name.trim().split(/\s+/)[0]
    : 'there'

  const accountType = role
    ? role
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Customer'

  /*
   * Role-specific workspace.
   * This gives operational users a clear entry point without making
   * the account area feel like a generic admin dashboard.
   */
  const workspace =
    role === 'vendor'
      ? {
          to: '/vendor',
          icon: Store,
          title: 'Vendor portal',
          body: 'Products, inventory, orders and settlements.',
        }
      : role === 'logistics'
        ? {
            to: '/logistics',
            icon: Truck,
            title: 'Logistics',
            body: 'Deliveries assigned to you.',
          }
        : role === 'admin' || role === 'super_admin'
          ? {
              to: '/admin',
              icon: Shield,
              title: 'Admin control center',
              body: 'Vendors, orders, finance and support.',
            }
          : null

  const cards: AccountCard[] = [
    ...(workspace
      ? [
          {
            ...workspace,
            eyebrow: 'Workspace',
            featured: true,
          },
        ]
      : []),
    {
      to: '/account/orders',
      icon: PackageSearch,
      title: 'Orders',
      eyebrow: 'Purchases',
      body: 'Follow deliveries and view your complete purchase history.',
    },
    {
      to: '/wishlist',
      icon: Heart,
      title: 'Wishlist',
      eyebrow: 'Saved pieces',
      body:
        wishCount > 0
          ? `${wishCount} ${wishCount === 1 ? 'piece' : 'pieces'} currently saved for later.`
          : 'Save exceptional pieces and return to them whenever you are ready.',
    },
    {
      to: '/account/returns',
      icon: Undo2,
      title: 'Returns',
      eyebrow: 'Aftercare',
      body: 'Start a return or check the status of an existing request.',
    },
    {
      to: '/account/support',
      icon: LifeBuoy,
      title: 'Karta support',
      eyebrow: 'Concierge',
      body: 'Reach the Karta team for help with an order or your account.',
    },
  ]

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#151b1c]">
      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="relative overflow-hidden border-b border-[#151b1c]/[0.07]">
        {/* Ambient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#b79a6b]/[0.09] blur-3xl"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-40 h-[30rem] w-[30rem] rounded-full bg-white/80 blur-3xl"
        />

        <div className="container-x relative pb-16 pt-14 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[#b79a6b]" />

            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#8f7651] sm:text-[10px]">
              Karta Private Account
            </p>
          </div>

          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end lg:gap-20">
            <div>
              <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#151b1c]/30">
                {accountType}
              </p>

              <h1 className="max-w-4xl font-display text-[3.2rem] font-medium leading-[0.92] tracking-[-0.06em] sm:text-6xl lg:text-[5.5rem]">
                Welcome,
                <br />
                <span className="text-[#8f7651]">{firstName}.</span>
              </h1>

              <p className="mt-7 max-w-xl text-sm leading-7 text-[#151b1c]/50 sm:text-[15px]">
                Your personal Karta space for orders, saved pieces, support
                and everything connected to your furniture journey.
              </p>
            </div>

            {/* Small account statement */}
            <div className="hidden border-l border-[#151b1c]/10 pl-7 lg:block">
              <Sparkles className="h-5 w-5 text-[#8f7651]" />

              <p className="mt-5 font-display text-2xl leading-[1.15] tracking-[-0.025em]">
                Beautiful spaces begin with considered pieces.
              </p>

              <p className="mt-4 text-sm leading-6 text-[#151b1c]/40">
                Continue exploring the Karta collection.
              </p>
            </div>
          </div>

          {/* Account summary */}
          <div className="mt-12 overflow-hidden rounded-[1.5rem] bg-[#151b1c] text-white shadow-[0_24px_65px_rgba(21,27,28,0.12)]">
            <div className="grid sm:grid-cols-3">
              <div className="px-6 py-5 sm:px-7">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
                  Account
                </p>

                <p className="mt-1 text-sm font-medium text-white/80">
                  {accountType}
                </p>
              </div>

              <div className="border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0 sm:px-7">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
                  Wishlist
                </p>

                <p className="mt-1 font-display text-xl text-white">
                  {wishCount}
                  <span className="ml-2 font-sans text-xs text-white/35">
                    {wishCount === 1 ? 'piece' : 'pieces'}
                  </span>
                </p>
              </div>

              <div className="border-t border-white/10 px-6 py-5 sm:border-l sm:border-t-0 sm:px-7">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
                  Experience
                </p>

                <p className="mt-1 text-sm font-medium text-white/80">
                  Karta private access
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          ACCOUNT SERVICES
      ================================================================ */}
      <section className="container-x py-16 sm:py-24 lg:py-28">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
              Account services
            </p>

            <h2 className="mt-2 font-display text-3xl tracking-[-0.035em] sm:text-4xl">
              Your Karta space
            </h2>
          </div>

          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/25 sm:block">
            {cards.length} services
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {cards.map(
            ({
              to,
              icon: Icon,
              title,
              body,
              eyebrow,
              featured,
            }) => (
              <Link
                key={to}
                to={to}
                className={[
                  'group relative overflow-hidden rounded-[1.5rem] border p-6 transition-all duration-500 sm:p-7',
                  featured
                    ? 'border-[#151b1c] bg-[#151b1c] text-white shadow-[0_25px_65px_rgba(21,27,28,0.12)] hover:-translate-y-1 hover:shadow-[0_30px_75px_rgba(21,27,28,0.17)]'
                    : 'border-[#151b1c]/[0.08] bg-white/65 hover:-translate-y-1 hover:border-[#151b1c]/15 hover:bg-white hover:shadow-[0_24px_55px_rgba(21,27,28,0.07)]',
                ].join(' ')}
              >
                {/* Decorative glow */}
                <span
                  aria-hidden="true"
                  className={[
                    'pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full blur-3xl transition-opacity duration-500',
                    featured
                      ? 'bg-[#b79a6b]/15 opacity-100'
                      : 'bg-[#b79a6b]/10 opacity-0 group-hover:opacity-100',
                  ].join(' ')}
                />

                <div className="relative flex items-start justify-between">
                  <span
                    className={[
                      'flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300',
                      featured
                        ? 'border-white/10 bg-white/[0.07]'
                        : 'border-[#151b1c]/[0.07] bg-[#151b1c]/[0.035] group-hover:border-[#b79a6b]/30 group-hover:bg-[#b79a6b]/10',
                    ].join(' ')}
                  >
                    <Icon
                      className={[
                        'h-[18px] w-[18px]',
                        featured
                          ? 'text-[#d6bd91]'
                          : 'text-[#8f7651]',
                      ].join(' ')}
                    />
                  </span>

                  <ArrowUpRight
                    className={[
                      'h-4 w-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
                      featured
                        ? 'text-white/30 group-hover:text-[#d6bd91]'
                        : 'text-[#151b1c]/25 group-hover:text-[#8f7651]',
                    ].join(' ')}
                  />
                </div>

                <div className="relative mt-8">
                  <p
                    className={[
                      'text-[9px] font-semibold uppercase tracking-[0.22em]',
                      featured
                        ? 'text-[#d6bd91]'
                        : 'text-[#8f7651]',
                    ].join(' ')}
                  >
                    {eyebrow}
                  </p>

                  <h3
                    className={[
                      'mt-2 font-display text-[1.5rem] tracking-[-0.025em]',
                      featured ? 'text-white' : 'text-[#151b1c]',
                    ].join(' ')}
                  >
                    {title}
                  </h3>

                  <p
                    className={[
                      'mt-2 max-w-md text-sm leading-6',
                      featured
                        ? 'text-white/50'
                        : 'text-[#151b1c]/50',
                    ].join(' ')}
                  >
                    {body}
                  </p>
                </div>

                <div
                  className={[
                    'relative mt-7 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em]',
                    featured
                      ? 'text-white/35 group-hover:text-[#d6bd91]'
                      : 'text-[#151b1c]/25 group-hover:text-[#8f7651]',
                  ].join(' ')}
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </Link>
            ),
          )}
        </div>
      </section>

      {/* ================================================================
          BRAND CLOSING
      ================================================================ */}
      <section className="container-x pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[#151b1c]/[0.08] bg-[#e6dfd3] px-7 py-12 sm:px-10 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/60 blur-3xl"
          />

          <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
                Karta
              </p>

              <h2 className="mt-3 font-display text-3xl leading-[1] tracking-[-0.04em] sm:text-4xl">
                Thoughtful pieces.
                <br />
                Considered living.
              </h2>

              <p className="mt-4 text-sm leading-6 text-[#151b1c]/45">
                Continue exploring furniture and objects selected for
                beautiful, lasting spaces.
              </p>
            </div>

            <Link
              to="/"
              className="group inline-flex h-12 w-fit items-center gap-3 rounded-full bg-[#151b1c] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#252d2e] hover:shadow-[0_16px_35px_rgba(21,27,28,0.16)]"
            >
              Continue shopping
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
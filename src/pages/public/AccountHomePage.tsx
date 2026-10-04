import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  LifeBuoy,
  LogOut,
  PackageSearch,
<<<<<<< HEAD
  Shield,
=======
  Settings,
  Shield,
  Sparkles,
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
  Store,
  Truck,
  Undo2,
  UserRound,
} from 'lucide-react'

import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'
import { useCartStore } from '@/store/cart.store'

type WorkspaceCard = {
  to: string
  icon: typeof Store
  title: string
  body: string
}

type AccountCard = {
  to: string
  icon: typeof Store
  title: string
  body: string
  eyebrow?: string
  featured?: boolean
}

export default function AccountHomePage() {
  useDocumentTitle('My Account | Karta')

  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const wishCount = useCartStore((s) => s.wishlist.length)

  const role = user?.role

  const firstName = user?.name?.trim()
    ? user.name.trim().split(/\s+/)[0]
    : 'there'

  /*
   * Role-specific workspace.
   * Keeps operational accounts visually connected to the main Karta account
   * without making the customer account feel like an admin dashboard.
   */
  const workspace: WorkspaceCard | null =
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
            body: 'Manage deliveries assigned to you.',
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
<<<<<<< HEAD
=======
      to: '/account/settings',
      icon: Settings,
      title: 'Settings',
      body: 'Edit your details, delivery addresses and notification preferences.',
      eyebrow: 'Profile',
    },
    {
      to: '/account/requests',
      icon: Sparkles,
      title: 'Custom requests',
      body: 'Ask vendors to make a piece you can’t find, and review their offers.',
      eyebrow: 'Made for you',
    },
    {
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
      to: '/account/orders',
      icon: PackageSearch,
      title: 'Orders',
      body: 'Follow deliveries, review purchases and view your order history.',
      eyebrow: 'Purchases',
    },
    {
      to: '/wishlist',
      icon: Heart,
      title: 'Wishlist',
      body:
        wishCount > 0
          ? `${wishCount} ${wishCount === 1 ? 'piece' : 'pieces'} currently saved for later.`
          : 'Save exceptional pieces you may want to return to.',
      eyebrow: 'Saved pieces',
    },
    {
      to: '/account/returns',
      icon: Undo2,
      title: 'Returns',
      body: 'Start a return or review the status of an existing request.',
      eyebrow: 'Aftercare',
    },
    {
      to: '/account/support',
      icon: LifeBuoy,
      title: 'Karta support',
      body: 'Reach the Karta team for help with your orders or account.',
      eyebrow: 'Concierge',
    },
  ]

  const details = [
    ['Name', user?.name],
    ['Email', user?.email],
    ['Phone', user?.phone],
    ['Business', user?.businessName],
    ['Account type', role ? role.replace(/_/g, ' ') : undefined],
  ].filter(([, value]) => value) as [string, string][]

  const accountLabel = role
    ? role
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Customer'

  const signOut = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#151b1c]">
      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="relative overflow-hidden border-b border-[#151b1c]/[0.07]">
        {/* Ambient luxury background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#b79a6b]/[0.07] blur-3xl"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 bottom-[-12rem] h-[30rem] w-[30rem] rounded-full bg-white/70 blur-3xl"
        />

        <div className="container-x relative pb-14 pt-12 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[#b79a6b]" />

            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#8f7651] sm:text-[10px]">
              Karta Private Account
            </p>
          </div>

          <div className="mt-7 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#151b1c]/35">
                {accountLabel}
              </p>

              <h1 className="font-display text-[2.8rem] font-medium leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-[5.2rem]">
                Welcome,
                <br />
                <span className="text-[#8f7651]">{firstName}.</span>
              </h1>

              <p className="mt-6 max-w-xl text-sm leading-7 text-[#151b1c]/55 sm:text-[15px]">
                Everything you need to manage your Karta experience,
                from saved pieces and orders to support and account details.
              </p>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="group inline-flex h-12 w-fit items-center gap-3 rounded-full border border-[#151b1c]/10 bg-white/65 px-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#151b1c]/65 backdrop-blur-md transition-all duration-300 hover:border-[#151b1c]/20 hover:bg-white hover:text-[#151b1c] hover:shadow-[0_14px_35px_rgba(21,27,28,0.07)]"
            >
              <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
              Sign out
            </button>
          </div>

          {/* Account summary strip */}
          <div className="mt-10 grid overflow-hidden rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-[#151b1c] text-white shadow-[0_24px_70px_rgba(21,27,28,0.12)] sm:grid-cols-3">
            <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <UserRound className="h-4 w-4 text-[#d6bd91]" />
              </span>

              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                  Account
                </p>
                <p className="mt-1 truncate text-sm font-medium text-white/85">
                  {accountLabel}
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-5 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Saved pieces
              </p>

              <p className="mt-1 font-display text-xl tracking-[-0.02em] text-white">
                {wishCount}
                <span className="ml-2 font-sans text-xs text-white/40">
                  {wishCount === 1 ? 'piece' : 'pieces'}
                </span>
              </p>
            </div>

            <div className="border-t border-white/10 px-5 py-5 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Karta service
              </p>

              <p className="mt-1 text-sm font-medium text-white/85">
                Private client care
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          ACCOUNT CONTENT
      ================================================================ */}
      <section className="container-x py-14 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-14">
          {/* ============================================================
              ACCOUNT SERVICES
          ============================================================ */}
          <div>
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
                  Account services
                </p>

                <h2 className="mt-2 font-display text-2xl tracking-[-0.035em] sm:text-3xl">
                  Your Karta space
                </h2>
              </div>

              <span className="hidden text-[10px] uppercase tracking-[0.18em] text-[#151b1c]/30 sm:block">
                {cards.length} services
              </span>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
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
                      'group relative overflow-hidden rounded-[1.45rem] border p-6 transition-all duration-500',
                      featured
                        ? 'border-[#151b1c] bg-[#151b1c] text-white shadow-[0_24px_60px_rgba(21,27,28,0.12)] hover:-translate-y-1 hover:shadow-[0_30px_75px_rgba(21,27,28,0.17)]'
                        : 'border-[#151b1c]/[0.08] bg-white/65 hover:-translate-y-1 hover:border-[#151b1c]/15 hover:bg-white hover:shadow-[0_24px_55px_rgba(21,27,28,0.07)]',
                    ].join(' ')}
                  >
                    {/* Decorative glow */}
                    <span
                      aria-hidden="true"
                      className={[
                        'pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl transition-opacity duration-500',
                        featured
                          ? 'bg-[#b79a6b]/15 opacity-100 group-hover:opacity-80'
                          : 'bg-[#b79a6b]/10 opacity-0 group-hover:opacity-100',
                      ].join(' ')}
                    />

                    <div className="relative flex items-start justify-between gap-5">
                      <span
                        className={[
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
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
                            ? 'text-white/35 group-hover:text-[#d6bd91]'
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
                          'mt-2 font-display text-[1.45rem] tracking-[-0.025em]',
                          featured ? 'text-white' : 'text-[#151b1c]',
                        ].join(' ')}
                      >
                        {title}
                      </h3>

                      <p
                        className={[
                          'mt-2 max-w-sm text-sm leading-6',
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
                        'relative mt-7 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] transition-all duration-300',
                        featured
                          ? 'text-white/40 group-hover:text-[#d6bd91]'
                          : 'text-[#151b1c]/30 group-hover:text-[#8f7651]',
                      ].join(' ')}
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </Link>
                ),
              )}
            </div>
          </div>

          {/* ============================================================
              PERSONAL DETAILS
          ============================================================ */}
          <aside className="h-fit overflow-hidden rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-white/65 shadow-[0_18px_50px_rgba(21,27,28,0.04)] backdrop-blur-sm">
            <div className="border-b border-[#151b1c]/[0.07] px-6 py-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">
                    Profile
                  </p>

                  <h2 className="mt-2 font-display text-2xl tracking-[-0.025em]">
                    Your details
                  </h2>
                </div>

                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#151b1c]/[0.07] bg-[#f7f4ee]">
                  <UserRound className="h-4 w-4 text-[#8f7651]" />
                </span>
              </div>
            </div>

            <div className="px-6 py-6">
              {details.length > 0 ? (
                <dl className="divide-y divide-[#151b1c]/[0.07]">
                  {details.map(([label, value]) => (
                    <div key={label} className="py-4 first:pt-0 last:pb-0">
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.19em] text-[#151b1c]/30">
                        {label}
                      </dt>

                      <dd className="mt-1.5 break-words text-sm leading-6 text-[#151b1c]/75">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="py-5 text-sm leading-6 text-[#151b1c]/45">
                  Your account details will appear here.
                </div>
              )}
            </div>

            <div className="border-t border-[#151b1c]/[0.07] bg-[#f7f4ee]/55 px-6 py-5">
              <p className="text-xs leading-5 text-[#151b1c]/40">
                Your information is used to manage your Karta account,
                purchases and customer service.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* ================================================================
          SIGNATURE FOOTER MOMENT
      ================================================================ */}
      <section className="container-x pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[#151b1c]/[0.08] bg-[#eae5db] px-6 py-10 sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/50 blur-3xl"
          />

          <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
                Karta
              </p>

              <h2 className="mt-3 max-w-md font-display text-3xl leading-[1] tracking-[-0.04em] sm:text-4xl">
                Thoughtful pieces.
                <br />
                Considered living.
              </h2>

              <p className="mt-4 max-w-lg text-sm leading-6 text-[#151b1c]/45">
                Continue exploring furniture and objects selected for
                beautiful, lasting spaces.
              </p>
            </div>

            <Link
              to="/"
              className="group inline-flex h-12 w-fit items-center gap-3 rounded-full bg-[#151b1c] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#252d2e] hover:shadow-[0_15px_35px_rgba(21,27,28,0.18)]"
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
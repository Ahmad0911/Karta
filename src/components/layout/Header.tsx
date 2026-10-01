import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react'

import Logo from '@/components/brand/Logo'
import { rooms } from '@/data/rooms'
import { useAuthStore } from '@/store/auth.store'
import { useCartCount, useCartStore } from '@/store/cart.store'

/* -------------------------------------------------------------------------- */
/* Count badge                                                                */
/* -------------------------------------------------------------------------- */

const Count = ({ n }: { n: number }) =>
  n > 0 ? (
    <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-brass-500 px-1 text-[9px] font-semibold leading-none text-ink ring-2 ring-paper">
      {n}
    </span>
  ) : null

/* -------------------------------------------------------------------------- */
/* Shared styles                                                              */
/* -------------------------------------------------------------------------- */

const iconButton =
  'group relative flex h-10 w-10 items-center justify-center rounded-full text-ink/60 transition-all duration-300 hover:bg-ink/[0.045] hover:text-ink'

const navBase =
  'relative text-[12px] tracking-[0.01em] transition-colors duration-300 after:absolute after:-bottom-[21px] after:left-0 after:h-px after:bg-brass-500 after:transition-all after:duration-300'

const navIdle = `${navBase} font-medium text-ink/55 hover:text-ink after:w-0 hover:after:w-full`
const navActive = `${navBase} font-semibold text-ink after:w-full`

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export default function Header() {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')

  const navigate = useNavigate()
  const { pathname, search: urlSearch } = useLocation()

  const user = useAuthStore((s) => s.user)
  const cart = useCartCount()
  const wish = useCartStore((s) => s.wishlist.length)

  // Which nav item matches the current URL.
  const activeRoom =
    pathname === '/shop' ? new URLSearchParams(urlSearch).get('room') : null
  const shopAllActive = pathname === '/shop' && !activeRoom

  // Close menus after any navigation.
  useEffect(() => {
    setOpen(false)
    setSearchOpen(false)
  }, [pathname, urlSearch])

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()

    const query = q.trim()

    navigate(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop')
  }

  return (
    <header className="sticky top-0 z-50">
      {/* Announcement bar */}
      <div className="bg-ink text-paper">
        <div className="container-x flex min-h-[32px] items-center justify-center">
          <p className="text-center text-[9px] font-medium uppercase tracking-[0.24em] text-paper/65 sm:text-[10px]">
            Verified vendors
            <span className="mx-3 text-brass-500">◆</span>
            Tracked delivery
            <span className="mx-3 text-brass-500">◆</span>
            Assembly available
          </p>
        </div>
      </div>

      {/* Main navigation */}
      <div className="border-b border-ink/[0.08] bg-paper/95 backdrop-blur-2xl">
        <div className="container-x">
          <div className="flex h-[5.25rem] items-center justify-between gap-6">
            <div className="shrink-0">
              <Logo />
            </div>

            {/* Desktop navigation */}
            <nav
              className="hidden items-center gap-7 lg:flex"
              aria-label="Primary navigation"
            >
              <Link
                to="/shop"
                aria-current={shopAllActive ? 'page' : undefined}
                className={
                  shopAllActive
                    ? `${navActive} uppercase tracking-[0.12em]`
                    : `${navIdle} uppercase tracking-[0.12em]`
                }
              >
                Shop all
              </Link>

              {rooms.slice(0, 5).map((room) => (
                <Link
                  key={room.id}
                  to={`/shop?room=${room.id}`}
                  aria-current={activeRoom === room.id ? 'page' : undefined}
                  className={activeRoom === room.id ? navActive : navIdle}
                >
                  {room.name}
                </Link>
              ))}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* Wide desktop: always-visible search */}
              <form
                onSubmit={submitSearch}
                role="search"
                className="relative mr-2 hidden xl:block"
              >
                <Search className="pointer-events-none absolute left-4 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/30" />

                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search the collection"
                  aria-label="Search furniture and vendors"
                  className="h-10 w-60 rounded-full border border-ink/[0.09] bg-white/45 pl-10 pr-4 text-[12px] text-ink outline-none transition-all duration-500 placeholder:text-ink/30 hover:border-ink/[0.15] hover:bg-white/70 focus:w-72 focus:border-ink/20 focus:bg-white focus:ring-4 focus:ring-ink/[0.025]"
                />
              </form>

              {/* Narrow desktop (lg to xl): search icon opens a panel */}
              <button
                type="button"
                aria-label={searchOpen ? 'Close search' : 'Search'}
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen((v) => !v)}
                className={`${iconButton} hidden lg:flex xl:hidden`}
              >
                {searchOpen ? (
                  <X className="h-[17px] w-[17px] stroke-[1.6]" />
                ) : (
                  <Search className="h-[17px] w-[17px] stroke-[1.6]" />
                )}
              </button>

              <Link
                to={user ? '/account' : '/login'}
                aria-label={user ? 'Account' : 'Sign in'}
                className={iconButton}
              >
                <User className="h-[17px] w-[17px] stroke-[1.6] transition-transform duration-300 group-hover:scale-105" />
              </Link>

              <Link
                to="/wishlist"
                aria-label={`Wishlist, ${wish} items`}
                className={iconButton}
              >
                <Heart className="h-[17px] w-[17px] stroke-[1.6] transition-transform duration-300 group-hover:scale-105 group-hover:fill-current" />
                <Count n={wish} />
              </Link>

              <Link
                to="/cart"
                aria-label={`Cart, ${cart} items`}
                className={iconButton}
              >
                <ShoppingBag className="h-[17px] w-[17px] stroke-[1.6] transition-transform duration-300 group-hover:scale-105" />
                <Count n={cart} />
              </Link>

              <button
                type="button"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`${iconButton} lg:hidden`}
              >
                {open ? (
                  <X className="h-[19px] w-[19px] stroke-[1.5]" />
                ) : (
                  <Menu className="h-[19px] w-[19px] stroke-[1.5]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search panel for lg to xl */}
      {searchOpen && (
        <div className="hidden border-b border-ink/[0.08] bg-paper lg:block xl:hidden">
          <div className="container-x py-4">
            <form onSubmit={submitSearch} role="search" className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />

              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the collection"
                aria-label="Search furniture and vendors"
                className="h-12 w-full rounded-full border border-ink/[0.09] bg-white pl-11 pr-4 text-sm text-ink outline-none transition-all placeholder:text-ink/30 focus:border-ink/20 focus:ring-4 focus:ring-ink/[0.025]"
              />
            </form>
          </div>
        </div>
      )}

      {/* Mobile navigation */}
      <div
        className={`border-b border-ink/[0.08] bg-paper transition-all duration-500 ease-out lg:hidden ${
          open
            ? 'max-h-[calc(100dvh-7.5rem)] overflow-y-auto opacity-100'
            : 'invisible max-h-0 overflow-hidden opacity-0'
        }`}
      >
        <div className="container-x">
          <div className="space-y-7 py-7">
            <form onSubmit={submitSearch} role="search" className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the collection"
                aria-label="Search furniture and vendors"
                className="h-12 w-full rounded-full border border-ink/[0.09] bg-white pl-11 pr-4 text-sm text-ink outline-none transition-all placeholder:text-ink/30 focus:border-ink/20 focus:ring-4 focus:ring-ink/[0.025]"
              />
            </form>

            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-brass-700">
                Explore Karta
              </p>

              <h2 className="font-serif text-xl tracking-[-0.02em] text-ink">
                Shop by room
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Link
                to="/shop"
                className={`group flex items-center justify-between rounded-xl border px-4 py-3.5 text-[12px] font-semibold transition-all duration-300 ${
                  shopAllActive
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/[0.08] bg-white/60 text-ink/65 hover:border-ink/[0.15] hover:bg-white hover:text-ink'
                }`}
              >
                Shop all
                <ArrowRight className="h-3.5 w-3.5 opacity-40" />
              </Link>

              {rooms.map((room) => {
                const active = activeRoom === room.id

                return (
                  <Link
                    key={room.id}
                    to={`/shop?room=${room.id}`}
                    className={`group flex items-center justify-between rounded-xl border px-4 py-3.5 text-[12px] font-medium transition-all duration-300 ${
                      active
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/[0.08] bg-white/60 text-ink/65 hover:border-ink/[0.15] hover:bg-white hover:text-ink'
                    }`}
                  >
                    <span>{room.name}</span>

                    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-60" />
                  </Link>
                )
              })}
            </div>

            {/* Account shortcuts */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { to: user ? '/account' : '/login', label: user ? 'Account' : 'Sign in', icon: User, n: 0 },
                { to: '/wishlist', label: 'Wishlist', icon: Heart, n: wish },
                { to: '/cart', label: 'Bag', icon: ShoppingBag, n: cart },
              ].map(({ to, label, icon: Icon, n }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex flex-col items-center gap-2 rounded-xl border border-ink/[0.08] bg-white/60 px-3 py-4 text-[11px] font-medium text-ink/65 transition-all duration-300 hover:border-ink/[0.15] hover:bg-white hover:text-ink"
                >
                  <Icon className="h-[18px] w-[18px] stroke-[1.5]" />
                  {label}
                  {n > 0 && (
                    <span className="text-[10px] text-brass-700">{n}</span>
                  )}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-ink/[0.07] pt-5">
              <Link
                to="/become-a-vendor"
                className="group inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-700 transition-colors hover:text-ink"
              >
                Become a vendor
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <Link
                to="/help"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/50 transition-colors hover:text-ink"
              >
                Help
              </Link>

              <Link
                to="/track-order"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/50 transition-colors hover:text-ink"
              >
                Track an order
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
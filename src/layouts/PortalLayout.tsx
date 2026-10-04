import { useEffect, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'

import Logo from '@/components/brand/Logo'
import Toaster from '@/components/portal/Toaster'
import { useAuthStore } from '@/store/auth.store'

/* -------------------------------------------------------------------------- */
/* PortalLayout — shared shell for vendor, logistics (and later admin)        */
/* -------------------------------------------------------------------------- */

export interface PortalNavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Match the path exactly (use for the section index). */
  end?: boolean
  /** Small count shown beside the label (hidden when 0). */
  badge?: number
}

interface PortalLayoutProps {
  /** Shown under the logo, for example "Vendor portal". */
  title: string
  nav: PortalNavItem[]
  /** Optional line under the user's name, for example the business name. */
  subtitle?: string
}

export default function PortalLayout({ title, nav, subtitle }: PortalLayoutProps) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  // Close the drawer after navigating.
  useEffect(() => setOpen(false), [location.pathname])

  // Drawer: close on Escape and lock page scroll while it is open.
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const previous = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const signOut = () => {
    logout()
    navigate('/', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[#101e21] text-white">
      <div className="flex items-center justify-between px-6 pb-6 pt-7">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.3em] text-[#d6bd91]">
            {title}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label={`${title} navigation`} className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {nav.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                    isActive
                      ? 'bg-white/[0.09] font-medium text-white'
                      : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
                  ].join(' ')
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-[#d6bd91]" />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span
                    aria-label={`${badge} need attention`}
                    className="rounded-full bg-[#d6bd91] px-2 py-0.5 text-[10px] font-bold text-[#101e21]"
                  >
                    {badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/[0.05] p-3">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-white/45">{subtitle ?? user?.email}</p>
        </div>

        <div className="mt-3 grid gap-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View storefront
          </Link>

          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#151b1c]">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#151b1c]/[0.08] bg-[#f7f4ee]/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="-ml-2 rounded-full p-2 hover:bg-black/5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8f7651]">
            {title}
          </span>
          <span className="w-9" aria-hidden="true" />
        </div>

        <main
          id="portal-main"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12"
        >
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  )
}


import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react'

import { COMPANY } from '@/config/company'
import { isEmail, mailtoLink } from '@/lib/contact'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/auth.store'

const inputClass =
  'h-14 w-full rounded-[1rem] border border-[#151b1c]/[0.10] bg-[#fdfcf9] px-4 text-[14px] text-[#151b1c] outline-none transition-all duration-300 placeholder:text-[#151b1c]/30 hover:border-[#151b1c]/20 focus:border-[#8f7651]/60 focus:bg-white focus:ring-4 focus:ring-[#8f7651]/[0.08]'

const labelClass =
  'mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/45'

const trackingSteps = [
  {
    icon: CheckCircle2,
    label: 'Order confirmed',
    text: 'Your order has been received and verified.',
  },
  {
    icon: PackageCheck,
    label: 'Preparing',
    text: 'Your pieces are being prepared for dispatch.',
  },
  {
    icon: Truck,
    label: 'In transit',
    text: 'Your order is on its way to you.',
  },
  {
    icon: CheckCircle2,
    label: 'Delivered',
    text: 'Your order has arrived at its destination.',
  },
]

export default function TrackOrderPage() {
  useDocumentTitle('Track an order')

  const user = useAuthStore((s) => s.user)

  const [orderNo, setOrderNo] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [link, setLink] = useState<string | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!orderNo.trim()) {
      setError('Enter your order number.')
      return
    }

    if (!isEmail(email)) {
      setError('Enter the email used for the order.')
      return
    }

    setError('')

    const href = mailtoLink({
      to: COMPANY.supportEmail,
      subject: `Order update request: ${orderNo.trim()}`,
      body: `Hello Karta,\n\nPlease send me an update on order ${orderNo.trim()}.\n\nEmail on the order: ${email.trim()}`,
    })

    setLink(href)
    window.location.href = href
  }

  return (
    <div className="overflow-hidden bg-[#f8f6f1] text-[#151b1c]">
      {/* ================================================================
          HERO
      ================================================================ */}
      <section className="relative">
        {/* Architectural background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full border border-[#8f7651]/[0.10]" />
          <div className="absolute -right-20 -top-20 h-[24rem] w-[24rem] rounded-full border border-[#8f7651]/[0.08]" />
          <div className="absolute right-16 top-16 h-2 w-2 rounded-full bg-[#8f7651]/50" />

          <div className="absolute inset-y-0 left-[8%] w-px bg-[#151b1c]/[0.035]" />
          <div className="absolute inset-y-0 right-[8%] w-px bg-[#151b1c]/[0.035]" />
        </div>

        <div className="container-x relative pb-16 pt-14 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="h-px w-9 bg-[#8f7651]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#8f7651]">
                Order concierge
              </p>
            </div>

            <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-end">
              <div>
                <h1 className="max-w-4xl font-display text-[3.35rem] font-medium leading-[0.94] tracking-[-0.055em] sm:text-[4.7rem] lg:text-[5.7rem]">
                  Know where your
                  <br />
                  <span className="text-[#8f7651]">pieces are.</span>
                </h1>

                <p className="mt-7 max-w-2xl text-[15px] leading-8 text-[#151b1c]/60 sm:text-base">
                  Follow the journey of your Karta order from confirmation to
                  delivery. Signed-in customers can access their complete order
                  history and available delivery updates.
                </p>
              </div>

              <div className="hidden lg:block">
                <div className="border-l border-[#151b1c]/10 pl-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40">
                    Karta service
                  </p>

                  <p className="mt-3 font-display text-xl leading-tight">
                    Considered delivery,
                    <br />
                    from collection to home.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          TRACKING PANEL
      ================================================================ */}
      <section className="container-x relative pb-20 sm:pb-28">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ------------------------------------------------------------
              ACCOUNT TRACKING
          ------------------------------------------------------------ */}
          <div className="relative overflow-hidden rounded-[1.75rem] bg-[#151b1c] text-white shadow-[0_24px_70px_rgba(21,27,28,0.12)]">
            {/* Decorative circle */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/[0.08]" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full border border-[#d6bd91]/[0.14]" />

            <div className="relative p-7 sm:p-10 lg:p-12">
              <div className="flex items-center justify-between gap-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05]">
                  <PackageCheck className="h-5 w-5 text-[#d6bd91]" />
                </div>

                <span className="rounded-full border border-[#d6bd91]/20 bg-[#d6bd91]/[0.08] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d6bd91]">
                  Private access
                </span>
              </div>

              <h2 className="mt-10 max-w-md font-display text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
                {user
                  ? 'Your orders, all in one place.'
                  : 'Your order journey starts here.'}
              </h2>

              <p className="mt-4 max-w-lg text-sm leading-7 text-white/55">
                {user
                  ? 'Open your account to view your orders, review available delivery information and follow each purchase through its journey.'
                  : 'Sign in to access your complete order history and follow available delivery updates from your Karta account.'}
              </p>

              <Link
                to={user ? '/account/orders' : '/login'}
                state={user ? undefined : { from: '/account/orders' }}
                className="group mt-8 inline-flex h-13 items-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-[#151b1c] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f3eee5]"
              >
                {user ? 'View my orders' : 'Sign in to track'}

                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <div className="mt-12 grid gap-4 border-t border-white/[0.09] pt-7 sm:grid-cols-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Orders
                  </p>
                  <p className="mt-2 text-sm text-white/70">Centralised</p>
                </div>

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Updates
                  </p>
                  <p className="mt-2 text-sm text-white/70">Order based</p>
                </div>

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Support
                  </p>
                  <p className="mt-2 text-sm text-white/70">Available</p>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------
              GUEST SUPPORT
          ------------------------------------------------------------ */}
          <div className="rounded-[1.75rem] border border-[#151b1c]/[0.08] bg-white/75 p-7 shadow-[0_20px_60px_rgba(21,27,28,0.05)] backdrop-blur-sm sm:p-10 lg:p-12">
            <div className="flex items-center justify-between gap-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#151b1c]/[0.045]">
                <Mail className="h-5 w-5 text-[#8f7651]" />
              </div>

              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/35">
                Guest assistance
              </span>
            </div>

            <h2 className="mt-9 font-display text-3xl tracking-[-0.03em] sm:text-4xl">
              {link ? 'Request prepared.' : 'Need a personal update?'}
            </h2>

            {link ? (
              <div className="mt-5">
                <div className="rounded-[1.2rem] border border-[#8f7651]/20 bg-[#8f7651]/[0.06] p-5">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8f7651]" />

                    <div>
                      <p className="text-sm font-semibold">
                        Your support request is ready.
                      </p>

                      <p className="mt-2 text-sm leading-7 text-[#151b1c]/60">
                        Your email app should have opened with the request
                        prepared. Press send and the Karta team can respond
                        with an update.
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href={link}
                  className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#151b1c] underline decoration-[#8f7651]/50 underline-offset-4 transition-colors hover:text-[#8f7651]"
                >
                  Open email request again
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </div>
            ) : (
              <>
                <p className="mt-4 max-w-md text-sm leading-7 text-[#151b1c]/60">
                  If you cannot access your account, send us your order number
                  and the email used at checkout. Our team can help with an
                  order update.
                </p>

                <form
                  onSubmit={onSubmit}
                  noValidate
                  className="mt-8 space-y-5"
                >
                  <div>
                    <label htmlFor="t-order" className={labelClass}>
                      Order number
                    </label>

                    <input
                      id="t-order"
                      value={orderNo}
                      onChange={(e) => {
                        setOrderNo(e.target.value)
                        if (error) setError('')
                      }}
                      className={inputClass}
                      placeholder="e.g. KRT-10482"
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label htmlFor="t-email" className={labelClass}>
                      Email on the order
                    </label>

                    <input
                      id="t-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError('')
                      }}
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="group inline-flex h-13 w-full items-center justify-center gap-3 rounded-full bg-[#151b1c] px-6 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253033] sm:w-auto"
                  >
                    Request an update
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          DELIVERY JOURNEY
      ================================================================ */}
      <section className="border-y border-[#151b1c]/[0.07] bg-[#eeebe4]">
        <div className="container-x py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#8f7651]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">
                  The journey
                </p>
              </div>

              <h2 className="mt-5 max-w-md font-display text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">
                From confirmation
                <br />
                to your home.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-7 text-[#151b1c]/55">
                Your order moves through a considered sequence before it
                reaches you. Available status information will appear against
                your order.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {trackingSteps.map((step, index) => {
                const Icon = step.icon

                return (
                  <div
                    key={step.label}
                    className="group rounded-[1.25rem] border border-[#151b1c]/[0.08] bg-[#f8f6f1]/80 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#8f7651]/25 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#151b1c]/[0.08] bg-white">
                        <Icon className="h-4 w-4 text-[#8f7651]" />
                      </div>

                      <span className="text-[9px] font-semibold tracking-[0.18em] text-[#151b1c]/25">
                        0{index + 1}
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-xl tracking-[-0.02em]">
                      {step.label}
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-[#151b1c]/50">
                      {step.text}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SERVICE NOTES
      ================================================================ */}
      <section className="container-x py-16 sm:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-[#151b1c]/[0.07] bg-white/60 p-6">
            <Clock3 className="h-5 w-5 text-[#8f7651]" />

            <h3 className="mt-5 font-display text-xl">
              Delivery updates
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#151b1c]/50">
              Order-specific updates are available through your account or by
              contacting the support team.
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-[#151b1c]/[0.07] bg-white/60 p-6">
            <ShieldCheck className="h-5 w-5 text-[#8f7651]" />

            <h3 className="mt-5 font-display text-xl">
              Order information
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#151b1c]/50">
              Keep your order number and checkout email available whenever you
              contact us about an order.
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-[#151b1c]/[0.07] bg-white/60 p-6">
            <Truck className="h-5 w-5 text-[#8f7651]" />

            <h3 className="mt-5 font-display text-xl">
              Delivery guidance
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#151b1c]/50">
              For delivery information, preparation guidance and related
              details, visit our shipping page.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================
          FOOTER CTA
      ================================================================ */}
      <section className="container-x pb-20 sm:pb-28">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#151b1c] px-7 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border border-[#d6bd91]/[0.10]" />
          <div className="pointer-events-none absolute right-8 top-8 h-2 w-2 rounded-full bg-[#d6bd91]/60" />

          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#d6bd91]">
                Need more help?
              </p>

              <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
                We are here when you need us.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-white/50">
                Explore delivery information or contact the Karta team directly
                if you need assistance with your order.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                to="/shipping"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#151b1c] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f3eee5]"
              >
                Shipping information
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <Link
                to="/contact"
                className="inline-flex h-12 items-center rounded-full border border-white/[0.16] px-5 text-sm font-semibold text-white transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06]"
              >
                Contact Karta
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
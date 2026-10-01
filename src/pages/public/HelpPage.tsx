import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Search, X } from 'lucide-react'

import { POLICY } from '@/config/company'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

interface Faq {
  group: string
  q: string
  a: string
  link?: { label: string; to: string }
}

const FAQS: Faq[] = [
  {
    group: 'Ordering',
    q: 'How do I place an order?',
    a: 'Add a piece to your bag, review it, then continue to checkout. You will be asked to sign in or create an account, choose delivery and pay securely.',
    link: { label: 'Browse the collection', to: '/shop' },
  },
  {
    group: 'Ordering',
    q: 'Can I save pieces for later?',
    a: 'Yes. Tap the heart on any piece to add it to your wishlist. You can view your wishlist at any time, even without an account.',
    link: { label: 'Open wishlist', to: '/wishlist' },
  },
  {
    group: 'Ordering',
    q: 'How do I pay?',
    a: `Payments are processed securely by ${POLICY.paymentProviders}. Karta never stores your full card details.`,
  },
  {
    group: 'Delivery',
    q: 'How long will delivery take?',
    a: 'Each product page shows its own delivery estimate in days. Larger and made-to-order pieces can take longer.',
    link: { label: 'Shipping & delivery', to: '/shipping' },
  },
  {
    group: 'Delivery',
    q: 'How do I track my order?',
    a: 'Sign in and open your account to follow an order. If you cannot sign in, use the Track an order page and we will send you an update.',
    link: { label: 'Track an order', to: '/track-order' },
  },
  {
    group: 'Delivery',
    q: 'Can my furniture be assembled for me?',
    a: 'Where a piece offers professional assembly, you can add it in your bag before checkout. The fee is shown before you pay.',
  },
  {
    group: 'Returns',
    q: 'What if my piece arrives damaged?',
    a: 'Contact us on the day it arrives with your order number and photos. We will arrange a repair, replacement or refund.',
    link: { label: 'Contact support', to: '/contact?topic=returns' },
  },
  {
    group: 'Returns',
    q: 'How long do I have to return something?',
    a: `Tell us within ${POLICY.returnWindowDays} days of delivery. Approved refunds usually take ${POLICY.refundProcessingDays}.`,
    link: { label: 'Returns & refunds', to: '/returns' },
  },
  {
    group: 'Selling',
    q: 'How do I sell on Karta?',
    a: 'Apply through our vendor page. We review every application to keep the collection trusted before any piece goes live.',
    link: { label: 'Become a vendor', to: '/become-a-vendor' },
  },
  {
    group: 'Account',
    q: 'I cannot sign in. What should I do?',
    a: 'Check that you are using the email you registered with. If it still does not work, contact us and we will help you get back in.',
    link: { label: 'Contact us', to: '/contact' },
  },
]

export default function HelpPage() {
  useDocumentTitle('Help centre')

  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')

  const groups = ['All', ...Array.from(new Set(FAQS.map((f) => f.group)))]

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    return FAQS.filter(
      (f) =>
        (group === 'All' || f.group === group) &&
        (!term || `${f.q} ${f.a}`.toLowerCase().includes(term)),
    )
  }, [query, group])

  return (
    <div className="bg-[#f8f6f1] text-[#151b1c]">
      <section className="container-x pb-10 pt-14 sm:pb-14 sm:pt-20">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-[#b79a6b]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8f7651]">
            Help centre
          </p>
        </div>

        <h1 className="mt-6 max-w-3xl font-display text-[2.75rem] font-medium leading-[1] tracking-[-0.04em] sm:text-6xl lg:text-[4.5rem]">
          How can we help?
        </h1>

        <div className="relative mt-9 max-w-xl">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#151b1c]/30"
          />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search help articles"
            placeholder="Search delivery, returns, payments"
            className="h-14 w-full rounded-full border border-[#151b1c]/10 bg-white/75 pl-12 pr-12 text-sm outline-none transition-all placeholder:text-[#151b1c]/30 hover:border-[#151b1c]/20 focus:border-[#8f7651]/50 focus:bg-white"
          />

          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#151b1c]/40 transition-colors hover:bg-[#151b1c]/[0.06] hover:text-[#151b1c]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <section className="container-x pb-20 sm:pb-28">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {groups.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setGroup(name)}
              aria-pressed={group === name}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
                group === name
                  ? 'border-[#151b1c] bg-[#151b1c] text-white'
                  : 'border-[#151b1c]/10 bg-white/50 text-[#151b1c]/50 hover:border-[#151b1c]/25 hover:bg-white hover:text-[#151b1c]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-8 max-w-3xl">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-[#151b1c]/[0.08] bg-white/60 p-8">
              <p className="font-display text-2xl">No answers found.</p>
              <p className="mt-2 text-sm leading-7 text-[#151b1c]/55">
                Try a different word, or ask us directly and we will reply
                within one working day.
              </p>
              <Link
                to="/contact"
                className="mt-5 inline-flex h-11 items-center rounded-full bg-[#151b1c] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#253033]"
              >
                Contact us
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#151b1c]/[0.08] border-y border-[#151b1c]/[0.08]">
              {visible.map((faq) => (
                <li key={faq.q}>
                  <details className="group py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left [&::-webkit-details-marker]:hidden">
                      <span className="font-display text-lg tracking-[-0.01em] sm:text-xl">
                        {faq.q}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#151b1c]/40 transition-transform duration-300 group-open:rotate-180" />
                    </summary>

                    <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[#151b1c]/65">
                      {faq.a}
                    </p>

                    {faq.link && (
                      <Link
                        to={faq.link.to}
                        className="mt-4 inline-block text-sm font-medium text-[#8f7651] underline underline-offset-4 transition-colors hover:text-[#151b1c]"
                      >
                        {faq.link.label}
                      </Link>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-14 max-w-3xl rounded-[1.5rem] bg-[#151b1c] p-8 text-white">
          <p className="font-display text-2xl tracking-[-0.02em]">
            Still need a hand?
          </p>
          <p className="mt-2 text-sm leading-7 text-white/60">
            Our team replies within one working day.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#151b1c] transition-colors hover:bg-[#b79a6b]"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  )
}
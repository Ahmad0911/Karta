import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Clock,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  PackageSearch,
} from 'lucide-react'

import { COMPANY } from '@/config/company'
import { isEmail, mailtoLink } from '@/lib/contact'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { whatsappEnabled, whatsappLink } from '@/lib/whatsapp'

const TOPICS = [
  ['order', 'An existing order'],
  ['product', 'A piece or its availability'],
  ['delivery', 'Delivery or assembly'],
  ['returns', 'Returns and refunds'],
  ['vendor', 'Selling on Karta'],
  ['careers', 'Careers'],
  ['other', 'Something else'],
] as const

type Errors = Partial<Record<'name' | 'email' | 'message', string>>

const inputClass =
  'w-full rounded-[0.9rem] border border-[#151b1c]/[0.12] bg-white/70 px-4 text-[14px] text-[#151b1c] outline-none transition-all placeholder:text-[#151b1c]/30 hover:border-[#151b1c]/25 focus:border-[#151b1c]/40 focus:bg-white focus:ring-4 focus:ring-[#151b1c]/[0.04]'

const labelClass =
  'mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#151b1c]/50'

const channelClass =
  'group flex items-center gap-4 rounded-2xl border border-[#151b1c]/[0.08] bg-white/70 p-5 transition-all duration-300 hover:border-[#151b1c]/20 hover:bg-white'

const arrowClass =
  'h-4 w-4 text-[#151b1c]/30 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5'

export default function ContactPage() {
  useDocumentTitle('Contact us')

  const [params] = useSearchParams()
  const initialTopic = params.get('topic') ?? 'other'

  const [topic, setTopic] = useState(
    TOPICS.some(([value]) => value === initialTopic) ? initialTopic : 'other',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [sentLink, setSentLink] = useState<string | null>(null)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()

    const next: Errors = {}

    if (!name.trim()) next.name = 'Enter your name.'
    if (!isEmail(email)) next.email = 'Enter a valid email address.'
    if (message.trim().length < 10) {
      next.message = 'Tell us a little more (at least 10 characters).'
    }

    setErrors(next)
    if (Object.keys(next).length) return

    const topicLabel = TOPICS.find(([value]) => value === topic)?.[1] ?? topic

    const link = mailtoLink({
      to: COMPANY.supportEmail,
      subject: `${topicLabel}: message from ${name.trim()}`,
      body: `${message.trim()}\n\n${name.trim()}\n${email.trim()}`,
    })

    setSentLink(link)
    window.location.href = link
  }

  const errorText = (key: keyof Errors) =>
    errors[key] ? (
      <p role="alert" className="mt-2 text-xs text-red-700">
        {errors[key]}
      </p>
    ) : null

  return (
    <div className="bg-[#f8f6f1] text-[#151b1c]">
      <section className="container-x pb-10 pt-14 sm:pb-14 sm:pt-20">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-[#b79a6b]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8f7651]">
            Contact
          </p>
        </div>

        <h1 className="mt-6 max-w-3xl font-display text-[2.75rem] font-medium leading-[1] tracking-[-0.04em] sm:text-6xl lg:text-[4.5rem]">
          Talk to a person who knows the collection.
        </h1>

        <p className="mt-6 max-w-xl text-base leading-8 text-[#151b1c]/60">
          Questions about a piece, an order or selling on Karta. Pick the
          quickest way to reach us.
        </p>
      </section>

      <section className="container-x pb-20 sm:pb-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
          {/* Form */}
          <div>
            {sentLink ? (
              <div
                role="status"
                className="rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-white/70 p-7 sm:p-9"
              >
                <h2 className="font-display text-2xl tracking-[-0.02em]">
                  Your email is ready to send.
                </h2>

                <p className="mt-3 max-w-md text-sm leading-7 text-[#151b1c]/60">
                  We opened your email app with your message filled in. Press
                  send there and we will reply within one working day.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={sentLink}
                    className="inline-flex h-11 items-center rounded-full bg-[#151b1c] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#253033]"
                  >
                    Open email again
                  </a>

                  <button
                    type="button"
                    onClick={() => setSentLink(null)}
                    className="inline-flex h-11 items-center rounded-full border border-[#151b1c]/15 px-6 text-sm font-medium text-[#151b1c]/70 transition-colors hover:border-[#151b1c]/30 hover:text-[#151b1c]"
                  >
                    Edit message
                  </button>
                </div>

                <p className="mt-6 text-xs leading-6 text-[#151b1c]/45">
                  Nothing happened? Write to{' '}
                  <a
                    href={`mailto:${COMPANY.supportEmail}`}
                    className="underline underline-offset-4"
                  >
                    {COMPANY.supportEmail}
                  </a>{' '}
                  directly.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-6">
                <div>
                  <label htmlFor="c-topic" className={labelClass}>
                    What is this about?
                  </label>
                  <select
                    id="c-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className={`${inputClass} h-[54px]`}
                  >
                    {TOPICS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-name" className={labelClass}>
                      Your name
                    </label>
                    <input
                      id="c-name"
                      value={name}
                      autoComplete="name"
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={Boolean(errors.name)}
                      className={`${inputClass} h-[54px]`}
                    />
                    {errorText('name')}
                  </div>

                  <div>
                    <label htmlFor="c-email" className={labelClass}>
                      Email address
                    </label>
                    <input
                      id="c-email"
                      type="email"
                      value={email}
                      autoComplete="email"
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={Boolean(errors.email)}
                      className={`${inputClass} h-[54px]`}
                    />
                    {errorText('email')}
                  </div>
                </div>

                <div>
                  <label htmlFor="c-message" className={labelClass}>
                    Message
                  </label>
                  <textarea
                    id="c-message"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={Boolean(errors.message)}
                    placeholder="Include an order number or product name if you have one."
                    className={`${inputClass} resize-y py-4 leading-7`}
                  />
                  {errorText('message')}
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center rounded-full bg-[#151b1c] px-8 py-4 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253033] hover:shadow-[0_14px_32px_rgba(21,27,28,0.17)]"
                >
                  Send message
                </button>
              </form>
            )}
          </div>

          {/* Direct channels */}
          <aside className="space-y-3">
            {whatsappEnabled && (
              <a
                href={whatsappLink(
                  "Hello Karta, I'd like some help choosing a piece.",
                )}
                target="_blank"
                rel="noreferrer"
                className={channelClass}
              >
                <MessageCircle className="h-5 w-5 text-[#8f7651]" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">
                    Chat on WhatsApp
                  </span>
                  <span className="block text-xs text-[#151b1c]/45">
                    Quickest for product questions
                  </span>
                </span>
                <ArrowUpRight className={arrowClass} />
              </a>
            )}

            <a href={`mailto:${COMPANY.supportEmail}`} className={channelClass}>
              <Mail className="h-5 w-5 text-[#8f7651]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Email us</span>
                <span className="block truncate text-xs text-[#151b1c]/45">
                  {COMPANY.supportEmail}
                </span>
              </span>
              <ArrowUpRight className={arrowClass} />
            </a>

            <Link to="/help" className={channelClass}>
              <HelpCircle className="h-5 w-5 text-[#8f7651]" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">Help centre</span>
                <span className="block text-xs text-[#151b1c]/45">
                  Answers to common questions
                </span>
              </span>
              <ArrowUpRight className={arrowClass} />
            </Link>

            <Link to="/track-order" className={channelClass}>
              <PackageSearch className="h-5 w-5 text-[#8f7651]" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">
                  Track an order
                </span>
                <span className="block text-xs text-[#151b1c]/45">
                  See where your delivery is
                </span>
              </span>
              <ArrowUpRight className={arrowClass} />
            </Link>

            <div className="space-y-3 px-1 pt-4 text-xs leading-6 text-[#151b1c]/50">
              <p className="flex items-start gap-3">
                <Clock className="mt-1 h-3.5 w-3.5 shrink-0" />
                {COMPANY.supportHours}
              </p>
              <p className="flex items-start gap-3">
                <MapPin className="mt-1 h-3.5 w-3.5 shrink-0" />
                {COMPANY.legalName}, {COMPANY.location}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
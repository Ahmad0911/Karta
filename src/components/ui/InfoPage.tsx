import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

export interface InfoSection {
  id: string
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface InfoPageContent {
  eyebrow: string
  title: string
  intro: string
  updated?: string
  sections: InfoSection[]
  cta?: {
    title: string
    body: string
    label: string
    to: string
  }
  related?: { label: string; to: string }[]
}

export default function InfoPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  cta,
  related,
}: InfoPageContent) {
  return (
    <div className="bg-[#f8f6f1] text-[#151b1c]">
      {/* Header */}
      <section className="relative border-b border-[#151b1c]/[0.07]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-[#b79a6b]/[0.07] blur-3xl"
        />

        <div className="container-x relative pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pt-24">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#b79a6b]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8f7651]">
              {eyebrow}
            </p>
          </div>

          <h1 className="mt-6 max-w-3xl font-display text-[2.75rem] font-medium leading-[1] tracking-[-0.04em] sm:text-6xl lg:text-[4.75rem]">
            {title}
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-[#151b1c]/60">
            {intro}
          </p>

          {updated && (
            <p className="mt-6 text-xs text-[#151b1c]/40">{updated}</p>
          )}
        </div>
      </section>

      {/* Body */}
      <section className="container-x py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
          {sections.length > 2 && (
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-40">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#151b1c]/35">
                  On this page
                </p>

                <ul className="mt-5 space-y-3 border-l border-[#151b1c]/10">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="-ml-px block border-l border-transparent pl-4 text-sm text-[#151b1c]/50 transition-colors hover:border-[#8f7651] hover:text-[#151b1c]"
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          )}

          <div
            className={
              sections.length > 2 ? '' : 'lg:col-span-2 lg:max-w-3xl'
            }
          >
            <div className="max-w-2xl space-y-14">
              {sections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-40"
                >
                  <h2 className="font-display text-2xl tracking-[-0.02em] sm:text-3xl">
                    {section.heading}
                  </h2>

                  {section.paragraphs?.map((text) => (
                    <p
                      key={text}
                      className="mt-4 text-[15px] leading-8 text-[#151b1c]/65"
                    >
                      {text}
                    </p>
                  ))}

                  {section.bullets && (
                    <ul className="mt-5 space-y-3">
                      {section.bullets.map((text) => (
                        <li
                          key={text}
                          className="flex gap-3 text-[15px] leading-7 text-[#151b1c]/65"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-3 h-px w-3 shrink-0 bg-[#b79a6b]"
                          />
                          {text}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>

            {cta && (
              <div className="mt-20 max-w-2xl rounded-[1.75rem] bg-[#151b1c] p-8 text-white sm:p-10">
                <h2 className="font-display text-2xl tracking-[-0.02em] sm:text-3xl">
                  {cta.title}
                </h2>

                <p className="mt-3 max-w-md text-sm leading-7 text-white/60">
                  {cta.body}
                </p>

                <Link
                  to={cta.to}
                  className="group mt-7 inline-flex h-12 items-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-[#151b1c] transition-all duration-300 hover:bg-[#b79a6b]"
                >
                  {cta.label}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            )}

            {related && related.length > 0 && (
              <div className="mt-16 max-w-2xl border-t border-[#151b1c]/10 pt-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#151b1c]/35">
                  Related
                </p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {related.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-[#151b1c]/10 bg-white/60 px-4 py-2 text-sm text-[#151b1c]/65 transition-all duration-300 hover:border-[#151b1c]/25 hover:bg-white hover:text-[#151b1c]"
                      >
                        {item.label}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition-all duration-300 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
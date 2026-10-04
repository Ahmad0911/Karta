import { Link } from 'react-router-dom'
import { ArrowUpRight, Camera, Clock, PenLine } from 'lucide-react'

import { useAuthStore } from '@/store/auth.store'

/** Home page invitation: "can't find it? ask for it." */
export default function CustomRequestBand() {
  const signedIn = useAuthStore((s) => Boolean(s.user))

  return (
    <section aria-labelledby="request-band" className="border-t border-[#151b1c]/[0.06] bg-[#f8f6f1] py-20 sm:py-24">
      <div className="container-x grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">Made for you</p>
          <h2 id="request-band" className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-5xl">
            Can’t find it? <span className="italic text-[#151b1c]/65">Ask for it.</span>
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#151b1c]/65">
            Describe the piece you imagine or upload a photo. Verified makers tell you what it would cost and how long it would take. You choose whether to go ahead.
          </p>
          <Link to={signedIn ? '/request' : '/login'} state={{ from: '/request' }} className="group mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-[#151b1c] px-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#252d2e]">
            Request a piece <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <ol className="grid gap-3">
          {[
            [PenLine, 'Describe it', 'Size, style, materials, budget. Add reference photos.'],
            [Clock, 'Get an offer', 'One verified vendor takes it and quotes a price and a timeframe.'],
            [Camera, 'You decide', 'Accept to reserve it, or decline and it opens up again.'],
          ].map(([Icon, title, body], i) => {
            const I = Icon as typeof PenLine
            return (
              <li key={String(title)} className="flex gap-4 rounded-2xl border border-[#151b1c]/[0.08] bg-white/70 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eadb] text-[#8f7651]"><I aria-hidden="true" className="h-5 w-5" /></span>
                <span><span className="block text-sm font-semibold">{i + 1}. {String(title)}</span><span className="mt-0.5 block text-sm leading-6 text-[#151b1c]/55">{String(body)}</span></span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

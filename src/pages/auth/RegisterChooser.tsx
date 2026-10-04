import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, ChevronDown, ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react'

/**
 * "Join Karta": choose how you will use the platform.
 * Customer goes straight to sign-up. Vendor and Driver expand to show what
 * you'll need, because both are verified by the Karta team before they can
 * sell or deliver.
 */

type Open = 'vendor' | 'driver' | null

export default function RegisterChooser() {
  const location = useLocation()
  const [open, setOpen] = useState<Open>(null)

  // Keep "where to go after signing up" while moving between steps.
  const state = location.state

  return (
    <>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.32em] text-[#315d4b]">Secure account access</p>
      <span aria-hidden="true" className="mt-3 block h-px w-16 bg-[#315d4b]/50" />

      <h1 className="mt-10 font-display text-5xl font-medium leading-[1] tracking-[-0.04em] sm:text-6xl">Join Karta</h1>
      <p className="mt-4 text-lg text-ink/50">Choose how you will use the platform.</p>

      <div className="my-9 flex items-center gap-5" aria-hidden="true">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/30">Karta</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <ul className="space-y-4">
        {/* ------------------------------ Customer ------------------------------ */}
        <li>
          <Link
            to="/register?as=customer"
            state={state}
            className="group flex items-center gap-5 rounded-[1.75rem] border border-ink/[0.12] bg-white/80 p-5 transition hover:border-ink/25 hover:bg-white hover:shadow-[0_18px_50px_-35px_rgba(21,27,28,0.4)] sm:p-6"
          >
            <IconTile><ShoppingBag aria-hidden="true" className="h-7 w-7" /></IconTile>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold tracking-[-0.01em]">Customer</span>
              <span className="mt-1 block text-[15px] leading-6 text-ink/55">Shop beautiful furniture, follow your orders and request pieces made just for you.</span>
              <span className="mt-2 block text-sm text-ink/40">Includes custom furniture requests</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink/60" />
          </Link>
        </li>

        {/* ------------------------------- Vendor -------------------------------- */}
        <Expandable
          id="vendor"
          open={open === 'vendor'}
          onToggle={() => setOpen(open === 'vendor' ? null : 'vendor')}
          icon={<Store aria-hidden="true" className="h-7 w-7" />}
          title="Vendor"
          body="Sell your furniture, answer custom requests and manage orders and payouts."
          caption="Individual makers · Registered businesses"
        >
          <p className="text-sm font-semibold text-ink">What you’ll need</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/60">
            <li>· A valid government ID</li>
            <li>· Proof of your workshop or business address</li>
            <li>· CAC registration (registered businesses only)</li>
            <li>· A Nigerian bank account for payouts</li>
          </ul>
          <p className="mt-3 text-sm text-ink/45">You can list products once the Karta team has verified you. This usually takes 2 to 3 working days.</p>
          <Link to="/register?as=vendor" state={state} className="btn-dark mt-5 inline-flex items-center gap-2">Continue as vendor <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </Expandable>

        {/* ------------------------------- Driver -------------------------------- */}
        <Expandable
          id="driver"
          open={open === 'driver'}
          onToggle={() => setOpen(open === 'driver' ? null : 'driver')}
          icon={<Truck aria-hidden="true" className="h-7 w-7" />}
          title="Logistics partner"
          body="Deliver verified orders, collect from vendors and capture proof of delivery."
          caption="Motorbike · Car · Van · Truck"
        >
          <p className="text-sm font-semibold text-ink">What you’ll need</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/60">
            <li>· Government ID and a valid driver’s licence</li>
            <li>· Vehicle papers and plate number</li>
            <li>· A guarantor we can call</li>
            <li>· A verified phone number</li>
          </ul>
          <p className="mt-3 text-sm text-ink/45">You can accept deliveries once the Karta team has approved you.</p>
          <Link to="/apply/logistics" state={state} className="btn-dark mt-5 inline-flex items-center gap-2">Apply to drive <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </Expandable>
      </ul>

      <div className="mt-8 flex gap-4 rounded-[1.5rem] bg-ink/[0.045] p-5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[#315d4b]" />
        <p className="text-[15px] leading-7 text-ink/55">
          Karta verifies identity, business and driver details before anyone can sell or deliver, so you only deal with people we’ve checked.
        </p>
      </div>

      <p className="mt-8 text-center text-sm text-ink/55">
        Already registered?{' '}
        <Link to="/login" state={state} className="font-semibold text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </>
  )
}

function IconTile({ children }: { children: ReactNode }) {
  return <span className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-[#f1eadb] text-[#8f7651] sm:h-[4.75rem] sm:w-[4.75rem]">{children}</span>
}

function Expandable({
  id, open, onToggle, icon, title, body, caption, children,
}: {
  id: string
  open: boolean
  onToggle: () => void
  icon: ReactNode
  title: string
  body: string
  caption: string
  children: ReactNode
}) {
  return (
    <li className={`rounded-[1.75rem] border bg-white/80 transition ${open ? 'border-ink/25 bg-white shadow-[0_18px_50px_-35px_rgba(21,27,28,0.4)]' : 'border-ink/[0.12] hover:border-ink/25 hover:bg-white'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center gap-5 rounded-[1.75rem] p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bc8e63] sm:p-6"
      >
        <IconTile>{icon}</IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-semibold tracking-[-0.01em]">{title}</span>
          <span className="mt-1 block text-[15px] leading-6 text-ink/55">{body}</span>
          <span className="mt-2 block text-sm text-ink/40">{caption}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-ink/30 transition-transform duration-300 ${open ? 'rotate-180 text-ink/60' : ''}`} />
      </button>

      <div id={`${id}-panel`} hidden={!open} className="border-t border-ink/[0.08] px-5 pb-6 pt-5 sm:px-6 sm:pl-[7.5rem]">
        {children}
      </div>
    </li>
  )
}

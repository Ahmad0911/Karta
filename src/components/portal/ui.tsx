import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, X } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/* Shared portal UI (vendor, logistics, later admin)                          */
/* -------------------------------------------------------------------------- */

export type Tone = 'neutral' | 'amber' | 'green' | 'red' | 'blue'

const TONES: Record<Tone, string> = {
  neutral: 'bg-[#151b1c]/[0.05] text-[#151b1c]/65 ring-[#151b1c]/10',
  amber: 'bg-[#b7791f]/10 text-[#8a5a14] ring-[#b7791f]/20',
  green: 'bg-[#315d4b]/10 text-[#265041] ring-[#315d4b]/20',
  red: 'bg-[#9b302d]/10 text-[#8a2724] ring-[#9b302d]/20',
  blue: 'bg-[#2b4a6b]/10 text-[#24415f] ring-[#2b4a6b]/20',
}

export function StatusPill({
  tone,
  children,
}: {
  tone: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ${TONES[tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8f7651]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-[2rem] font-medium leading-[1.02] tracking-[-0.035em] sm:text-[2.6rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#151b1c]/55">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[1.25rem] border border-[#151b1c]/[0.08] bg-white/75 shadow-[0_14px_40px_-30px_rgba(21,27,28,0.35)] ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#151b1c]/[0.07] px-5 py-4 sm:px-6">
      <div>
        <h2 className="font-display text-xl tracking-[-0.02em]">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-[#151b1c]/45">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  to,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'neutral' | 'alert'
  to?: string
}) {
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40">
        {label}
      </p>
      <p
        className={`mt-3 font-display text-[1.9rem] leading-none tracking-[-0.03em] ${
          tone === 'alert' ? 'text-[#8a5a14]' : ''
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-5 text-[#151b1c]/45">{hint}</p>}
    </>
  )

  const cls =
    'block rounded-[1.25rem] border border-[#151b1c]/[0.08] bg-white/75 p-5 shadow-[0_14px_40px_-30px_rgba(21,27,28,0.35)]'

  return to ? (
    <Link to={to} className={`${cls} transition hover:-translate-y-0.5 hover:bg-white`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#151b1c]/[0.08] bg-[#f7f4ee] text-[#8f7651]">
        {icon}
      </span>
      <h3 className="mt-5 font-display text-xl tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#151b1c]/50">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Notice({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'success' | 'danger'
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const styles = {
    info: 'border-[#2b4a6b]/20 bg-[#2b4a6b]/[0.05]',
    warning: 'border-[#b7791f]/25 bg-[#b7791f]/[0.07]',
    success: 'border-[#315d4b]/20 bg-[#315d4b]/[0.06]',
    danger: 'border-[#9b302d]/25 bg-[#9b302d]/[0.06]',
  }[tone]

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex flex-col gap-4 rounded-[1.1rem] border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${styles}`}
    >
      <div className="flex gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {children && (
            <div className="mt-1 text-sm leading-6 text-[#151b1c]/60">{children}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ------------------------------ Form pieces ------------------------------- */

const inputBase =
  'w-full rounded-xl border bg-white px-4 text-sm text-[#151b1c] outline-none transition placeholder:text-[#151b1c]/30 hover:border-[#151b1c]/25 focus:border-[#151b1c]/50 focus:shadow-[0_0_0_4px_rgba(168,132,91,0.1)] disabled:cursor-not-allowed disabled:bg-[#151b1c]/[0.03] disabled:opacity-60'

export const inputClass = (invalid?: boolean) =>
  `${inputBase} h-12 ${invalid ? 'border-[#9b302d]/60' : 'border-[#151b1c]/[0.13]'}`

export const textareaClass = (invalid?: boolean) =>
  `${inputBase} min-h-[7.5rem] resize-y py-3 leading-6 ${
    invalid ? 'border-[#9b302d]/60' : 'border-[#151b1c]/[0.13]'
  }`

/**
 * Label + control + hint/error, wired for screen readers. Pass the same `id`
 * to the control and set aria-describedby={`${id}-msg`}.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55"
      >
        {label}
        {required && <span className="ml-1 text-[#9b302d]">*</span>}
      </label>
      {children}
      {(error || hint) && (
        <p
          id={`${id}-msg`}
          className={`mt-1.5 text-xs leading-5 ${error ? 'text-[#9b302d]' : 'text-[#151b1c]/40'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

/* -------------------------------- Buttons --------------------------------- */

export const primaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#151b1c] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#252d2e] disabled:cursor-not-allowed disabled:opacity-40'

export const secondaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#151b1c]/15 bg-white/70 px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#151b1c]/75 transition hover:border-[#151b1c]/30 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40'

export const dangerBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#9b302d]/30 bg-white/70 px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b302d] transition hover:bg-[#9b302d]/[0.06] disabled:cursor-not-allowed disabled:opacity-40'

/* --------------------------------- Toasts --------------------------------- */

export function Dismiss({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full p-1 text-current/60 transition hover:bg-black/5 hover:text-current"
    >
      <X className="h-4 w-4" />
    </button>
  )
}

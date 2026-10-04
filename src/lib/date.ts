/** Shared date helpers. All dates are ISO strings in storage. */

const DATE = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const DATE_TIME = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

const SHORT = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
})

export const formatDate = (iso: string) => DATE.format(new Date(iso))
export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso))
export const formatShortDate = (iso: string) => SHORT.format(new Date(iso))

export const addDays = (iso: string | Date, days: number) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d
}

export const startOfDay = (d: Date) => {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function timeAgo(iso: string, now = new Date()): string {
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / 1000),
  )

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return formatShortDate(iso)
}

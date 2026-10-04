import { useEffect } from 'react'
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react'

import { STORAGE_FULL_EVENT } from '@/lib/safeStorage'
import { toast, useToastStore } from '@/store/toast.store'
import { Dismiss } from './ui'

const ICON = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
} as const

const STYLE = {
  success: 'border-[#315d4b]/25 bg-[#f1f6f3] text-[#265041]',
  error: 'border-[#9b302d]/25 bg-[#fbf1f0] text-[#8a2724]',
  info: 'border-[#2b4a6b]/25 bg-[#f0f4f8] text-[#24415f]',
} as const

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  // Tell the user when the browser refuses to save (storage full or blocked).
  useEffect(() => {
    const onFull = () =>
      toast.error(
        'Your browser couldn’t save the latest changes. Remove a few photos or free up space.',
      )

    window.addEventListener(STORAGE_FULL_EVENT, onFull)
    return () => window.removeEventListener(STORAGE_FULL_EVENT, onFull)
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_50px_-20px_rgba(21,27,28,0.4)] ${STYLE[t.tone]}`}
          >
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-5">{t.message}</p>
            <Dismiss onClick={() => dismiss(t.id)} label="Dismiss message" />
          </div>
        )
      })}
    </div>
  )
}

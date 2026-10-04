import { useEffect, useRef } from 'react'
import { FlaskConical } from 'lucide-react'

import { formatNaira } from '@/lib/format'
import { mockGatewayRespond } from '@/modules/payments'

/** DEV-only stand-in for the provider's hosted payment page. */
export default function MockGatewayDialog({
  reference,
  amount,
  onClose,
}: {
  reference: string
  amount: number
  onClose: () => void
}) {
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && choose('abandoned')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (o: 'paid' | 'failed' | 'abandoned') => {
    mockGatewayRespond(reference, o)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="mock-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6540]">
          <FlaskConical className="h-4 w-4" /> Test gateway · development only
        </p>
        <h2 id="mock-title" className="mt-3 font-display text-2xl tracking-[-0.02em]">
          Pay {formatNaira(amount)}
        </h2>
        <p className="mt-1 text-xs text-[#151b1c]/50">Ref {reference}</p>

        <div className="mt-6 grid gap-2">
          <button ref={first} type="button" onClick={() => choose('paid')} className="h-11 rounded-full bg-[#151b1c] text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            Simulate successful payment
          </button>
          <button type="button" onClick={() => choose('failed')} className="h-11 rounded-full border border-[#9b302d]/30 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b302d]">
            Simulate declined card
          </button>
          <button type="button" onClick={() => choose('abandoned')} className="h-11 rounded-full border border-[#151b1c]/15 text-[11px] font-semibold uppercase tracking-[0.14em]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

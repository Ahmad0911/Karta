import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { primaryBtn } from '@/components/portal/ui'
import { useCartStore } from '@/store/cart.store'
import { resolvePaymentProvider } from '@/modules/payments'
import { settlePayment } from '@/modules/payments/settle'
import { PENDING_ORDER_KEY } from './CheckoutPage'

/**
 * Where a hosted payment page sends the customer back to.
 * The URL is NOT proof of payment: we ask the server to verify it.
 */
export default function CheckoutReturnPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const clearCart = useCartStore((s) => s.clear)
  const [state, setState] = useState<{ kind: 'checking' } | { kind: 'problem'; text: string }>({ kind: 'checking' })
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode runs effects twice; verify once.
    ran.current = true

    const reference = params.get('reference') ?? params.get('trxref') ?? params.get('tx_ref')
    const orderId = sessionStorage.getItem(PENDING_ORDER_KEY)
    const provider = resolvePaymentProvider()

    if (!reference || !orderId || !provider.ok) {
      setState({ kind: 'problem', text: 'We couldn’t find a payment to confirm. If you were charged, contact support with your payment reference.' })
      return
    }

    void settlePayment(provider.provider, orderId, reference).then((r) => {
      if (r.outcome === 'paid') {
        clearCart()
        sessionStorage.removeItem(PENDING_ORDER_KEY)
        navigate(`/account/orders/${orderId}`, { replace: true, state: { justPaid: true } })
      } else {
        setState({ kind: 'problem', text: r.message })
      }
    })
  }, [params, navigate, clearCart])

  return (
    <main className="container-x py-28 text-center">
      {state.kind === 'checking' ? (
        <>
          <h1 className="font-display text-4xl tracking-[-0.03em]">Confirming your payment…</h1>
          <p role="status" className="mt-3 text-sm text-ink/55">Please don’t close this page.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl tracking-[-0.03em]">We need a moment.</h1>
          <p role="alert" className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/60">{state.text}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/checkout" className={primaryBtn}>Back to checkout</Link>
            <Link to="/account/orders" className="inline-flex h-11 items-center rounded-full border border-ink/15 px-5 text-[11px] font-semibold uppercase tracking-[0.14em]">My orders</Link>
          </div>
        </>
      )}
    </main>
  )
}

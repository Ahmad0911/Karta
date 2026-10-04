import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'

import SafeImage from '@/components/ui/SafeImage'
import { Notice, FormField, inputClass, primaryBtn } from '@/components/portal/ui'
import { CHECKOUT_STATES, deliveryFeeFor } from '@/config/checkout'
import { SITE } from '@/config/site'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import VerificationPanel from '@/components/verification/VerificationPanel'
import { useAuthStore } from '@/store/auth.store'
import { useCartStore } from '@/store/cart.store'
import { toast } from '@/store/toast.store'

import { useCatalog } from '@/modules/catalog/useCatalog'
import { MAX_ADDRESSES, selectProfile, useProfileStore } from '@/modules/account/profile.store'
import { useOrdersStore, validateAddress } from '@/modules/orders/orders.store'
import type { DeliveryAddress } from '@/modules/orders/types'
import { resolvePaymentProvider, toKobo, type PaymentSession } from '@/modules/payments'
import { settlePayment } from '@/modules/payments/settle'
import MockGatewayDialog from './MockGatewayDialog'

export const PENDING_ORDER_KEY = 'karta-pending-order'

export default function CheckoutPage() {
  useDocumentTitle('Checkout')

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)!
  const { getProduct, ownerEmail } = useCatalog()
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clear)
  const createPendingOrder = useOrdersStore((s) => s.createPendingOrder)

  const providerState = useMemo(resolvePaymentProvider, [])

  const savedAddresses = useProfileStore(selectProfile(user.email)).addresses
  const saveAddress = useProfileStore((s) => s.saveAddress)
  const defaultAddress = savedAddresses.find((a) => a.isDefault)

  const [addr, setAddr] = useState<DeliveryAddress>(
    defaultAddress
      ? {
          fullName: defaultAddress.fullName,
          phone: defaultAddress.phone,
          street: defaultAddress.street,
          city: defaultAddress.city,
          state: defaultAddress.state,
          landmark: defaultAddress.landmark ?? '',
        }
      : { fullName: user.name, phone: user.phone ?? '', street: '', city: '', state: '', landmark: '' },
  )
  const [selectedId, setSelectedId] = useState<string>(defaultAddress?.id ?? 'new')
  const [saveForLater, setSaveForLater] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'warning' | 'danger'; text: string } | null>(null)
  const [gateway, setGateway] = useState<{ session: PaymentSession; orderId: string; total: number } | null>(null)

  // Reuse the same pending order on retry so a failed payment never creates duplicates.
  const pendingId = useRef<string | null>(null)

  const lines = items.flatMap((i) => {
    const product = getProduct(i.productId)
    return product ? [{ ...i, product }] : []
  })
  const unavailable = items.length - lines.length

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0)
  const assembly = lines.reduce((s, l) => s + (l.assembly && l.product.assemblyAvailable ? SITE.assemblyFee * l.qty : 0), 0)
  const delivery = addr.state ? deliveryFeeFor(addr.state) : 0
  const total = subtotal + assembly + delivery

  const set = (k: keyof DeliveryAddress) => (v: string) => {
    setAddr((a) => ({ ...a, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
    // Editing a saved address turns it into a one-off address.
    setSelectedId('new')
  }

  const chooseSaved = (id: string) => {
    setSelectedId(id)
    setErrors({})
    const a = savedAddresses.find((x) => x.id === id)
    if (a) {
      setAddr({ fullName: a.fullName, phone: a.phone, street: a.street, city: a.city, state: a.state, landmark: a.landmark ?? '' })
    } else {
      setAddr({ fullName: user.name, phone: user.phone ?? '', street: '', city: '', state: '', landmark: '' })
    }
  }

  const finish = (orderId: string) => {
    clearCart()
    sessionStorage.removeItem(PENDING_ORDER_KEY)
    navigate(`/account/orders/${orderId}`, { replace: true, state: { justPaid: true } })
  }

  const settle = async (orderId: string, reference: string) => {
    if (!providerState.ok) return
    const r = await settlePayment(providerState.provider, orderId, reference)

    if (r.outcome === 'paid') return finish(orderId)

    setMessage({ tone: r.outcome === 'pending' ? 'warning' : 'danger', text: r.message })
    if (r.outcome === 'failed' || r.outcome === 'abandoned') toast.error(r.message)
    setBusy(false)
  }

  const pay = async () => {
    if (busy || !providerState.ok) return

    const found = validateAddress(addr)
    setErrors(found)
    if (Object.keys(found).length) {
      toast.error('Please check your delivery details.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }

    setBusy(true)
    setMessage(null)

    // Create (or reuse) the pending order.
    let orderId = pendingId.current
    const existing = orderId ? useOrdersStore.getState().orders.find((o) => o.id === orderId) : undefined

    if (!existing || existing.total !== total || existing.status !== 'pending_payment') {
      const created = createPendingOrder({
        customerEmail: user.email,
        customerName: user.name,
        address: addr,
        items,
        getProduct,
        ownerEmail,
      })
      if (!created.ok) {
        setMessage({ tone: 'danger', text: created.error })
        setBusy(false)
        return
      }
      orderId = created.data.id
      pendingId.current = orderId

      if (saveForLater && selectedId === 'new' && savedAddresses.length < MAX_ADDRESSES) {
        saveAddress(user.email, { ...addr, label: addr.city || 'Delivery address' })
        setSaveForLater(false)
      }
    }

    const order = useOrdersStore.getState().orders.find((o) => o.id === orderId)!

    try {
      const session = await providerState.provider.initialize({
        orderId: order.id,
        orderNumber: order.number,
        amountKobo: toKobo(order.total),
        currency: 'NGN',
        customerEmail: user.email,
        customerName: user.name,
        returnUrl: `${window.location.origin}/checkout/return`,
      })

      if (session.mode === 'redirect' && session.checkoutUrl) {
        sessionStorage.setItem(PENDING_ORDER_KEY, order.id)
        window.location.assign(session.checkoutUrl)
        return
      }

      setGateway({ session, orderId: order.id, total: order.total })
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'We couldn’t start your payment. Please try again.' })
      setBusy(false)
    }
  }

  /* ------------------------------ empty / blocked ----------------------------- */

  if (lines.length === 0) {
    return (
      <main className="container-x py-24 text-center">
        <h1 className="font-display text-4xl tracking-[-0.03em]">Your cart is empty.</h1>
        {unavailable > 0 && <p className="mt-3 text-sm text-ink/55">Items that are no longer available were removed.</p>}
        <Link to="/shop" className={`${primaryBtn} mt-8`}>Continue shopping</Link>
      </main>
    )
  }

  const f = (k: keyof DeliveryAddress) => ({
    id: `c-${k}`,
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? `c-${k}-msg` : undefined,
  })

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x py-12 sm:py-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">Secure checkout</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] sm:text-5xl">Delivery & payment</h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            {!providerState.ok && <Notice tone="danger" title="Payments unavailable">{providerState.reason}</Notice>}
            {unavailable > 0 && <Notice tone="warning" title="Some items were removed">They are no longer available.</Notice>}
            {message && <Notice tone={message.tone} title={message.tone === 'danger' ? 'Payment problem' : 'Please wait'}>{message.text}</Notice>}

            {!user.phoneVerified && (
              <section className="rounded-[1.5rem] border border-[#b7791f]/30 bg-[#b7791f]/[0.06] p-5 sm:p-7">
                <h2 className="font-display text-2xl tracking-[-0.02em]">Verify your phone number</h2>
                <p className="mt-1 mb-4 text-sm text-[#151b1c]/60">Our driver will call this number about your delivery. It takes a few seconds.</p>
                <VerificationPanel channels={['phone']} />
              </section>
            )}

            <section className="rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-white/75 p-5 sm:p-7">
              <h2 className="font-display text-2xl tracking-[-0.02em]">Where should we deliver?</h2>

              {savedAddresses.length > 0 && (
                <div className="mt-6">
                  <FormField id="c-saved" label="Saved addresses">
                    <select id="c-saved" className={inputClass()} value={selectedId} onChange={(e) => chooseSaved(e.target.value)}>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>{a.label}: {a.street}, {a.city}{a.isDefault ? ' (default)' : ''}</option>
                      ))}
                      <option value="new">Use a different address</option>
                    </select>
                  </FormField>
                </div>
              )}

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <FormField id="c-fullName" label="Full name" required error={errors.fullName}>
                  <input {...f('fullName')} className={inputClass(!!errors.fullName)} value={addr.fullName} autoComplete="name" onChange={(e) => set('fullName')(e.target.value)} />
                </FormField>
                <FormField id="c-phone" label="Phone" required error={errors.phone} hint="The driver will call this number.">
                  <input {...f('phone')} type="tel" className={inputClass(!!errors.phone)} value={addr.phone} autoComplete="tel" onChange={(e) => set('phone')(e.target.value)} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField id="c-street" label="Street address" required error={errors.street}>
                    <input {...f('street')} className={inputClass(!!errors.street)} value={addr.street} autoComplete="street-address" onChange={(e) => set('street')(e.target.value)} />
                  </FormField>
                </div>
                <FormField id="c-city" label="City or town" required error={errors.city}>
                  <input {...f('city')} className={inputClass(!!errors.city)} value={addr.city} autoComplete="address-level2" onChange={(e) => set('city')(e.target.value)} />
                </FormField>
                <FormField id="c-state" label="State" required error={errors.state}>
                  <select {...f('state')} className={inputClass(!!errors.state)} value={addr.state} onChange={(e) => set('state')(e.target.value)}>
                    <option value="">Select a state</option>
                    {CHECKOUT_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <div className="sm:col-span-2">
                  <FormField id="c-landmark" label="Landmark (optional)" hint="Helps the driver find you.">
                    <input id="c-landmark" className={inputClass()} value={addr.landmark ?? ''} onChange={(e) => set('landmark')(e.target.value)} />
                  </FormField>
                </div>

                {selectedId === 'new' && savedAddresses.length < MAX_ADDRESSES && (
                  <label className="flex cursor-pointer items-center gap-3 text-sm sm:col-span-2">
                    <input type="checkbox" className="h-4 w-4 accent-[#151b1c]" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} />
                    Save this address for next time
                  </label>
                )}
              </div>
            </section>

            <p className="flex items-start gap-3 text-xs leading-5 text-[#151b1c]/55">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#315d4b]" />
              You pay Karta, not the vendor. We hold your payment until your order is delivered and the return window has passed, then release it to the vendor.
            </p>
          </div>

          {/* ------------------------------ Summary ------------------------------ */}
          <aside className="h-fit rounded-[1.5rem] border border-[#151b1c]/[0.08] bg-white p-5 shadow-[0_20px_60px_-40px_rgba(21,27,28,0.4)] sm:p-7 lg:sticky lg:top-24">
            <h2 className="font-display text-2xl tracking-[-0.02em]">Your order</h2>
            <ul className="mt-5 divide-y divide-[#151b1c]/[0.07]">
              {lines.map(({ product: p, qty, assembly: asm }) => (
                <li key={p.id} className="flex gap-3 py-3">
                  <SafeImage src={p.image} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-[#eae5db]" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-[#151b1c]/45">{p.vendor.name} · Qty {qty}{asm && p.assemblyAvailable ? ' · Assembly' : ''}</p>
                  </div>
                  <p className="text-sm tabular-nums">{formatNaira(p.price * qty)}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-[#151b1c]/[0.07] pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-[#151b1c]/55">Items</dt><dd className="tabular-nums">{formatNaira(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#151b1c]/55">Assembly</dt><dd className="tabular-nums">{assembly ? formatNaira(assembly) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[#151b1c]/55">Delivery</dt><dd className="tabular-nums">{addr.state ? formatNaira(delivery) : 'Choose a state'}</dd></div>
              <div className="flex justify-between border-t border-[#151b1c]/[0.07] pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{addr.state ? formatNaira(total) : '—'}</dd></div>
            </dl>

            <button type="button" className={`${primaryBtn} mt-6 w-full`} disabled={busy || !providerState.ok || !user.phoneVerified} onClick={pay}>
              <Lock className="h-4 w-4" />
              {busy ? 'Processing…' : addr.state ? `Pay ${formatNaira(total)}` : 'Pay securely'}
            </button>
            <p className="mt-3 text-center text-[11px] text-[#151b1c]/40">
              {providerState.ok ? `Payments processed by ${providerState.provider.label}` : 'Payments are currently unavailable'}
            </p>
          </aside>
        </div>
      </div>

      {gateway && (
        <MockGatewayDialog
          reference={gateway.session.reference}
          amount={gateway.total}
          onClose={() => {
            const g = gateway
            setGateway(null)
            void settle(g.orderId, g.session.reference)
          }}
        />
      )}
    </main>
  )
}

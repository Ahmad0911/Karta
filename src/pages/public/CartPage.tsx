
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react'

import { useCatalog } from '@/modules/catalog/useCatalog'
import { formatNaira } from '@/lib/format'
import { SITE } from '@/config/site'
import { useCartStore } from '@/store/cart.store'
import SafeImage from '@/components/ui/SafeImage'

export default function CartPage() {
  const { getProduct } = useCatalog()
  const { items, setQty, remove, toggleAssembly } = useCartStore()

  const lines = items.flatMap((item) => {
    const product = getProduct(item.productId)

    return product ? [{ ...item, product }] : []
  })

  const itemCount = lines.reduce((count, line) => count + line.qty, 0)

  const subtotal = lines.reduce(
    (total, line) => total + line.product.price * line.qty,
    0,
  )

  const assembly = lines.reduce(
    (total, line) =>
      total + (line.assembly ? SITE.assemblyFee * line.qty : 0),
    0,
  )

  const total = subtotal + assembly

  /* ---------------------------------------------------------------------- */
  /* Empty cart                                                             */
  /* ---------------------------------------------------------------------- */

  if (!lines.length) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#f8f6f1] text-[#151b1c]">
        <section className="relative flex min-h-[78vh] items-center justify-center">
          {/* Ambient lighting */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#b79a6b]/[0.08] blur-3xl"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#151b1c]/[0.025] blur-3xl"
          />

          <div className="container-x relative py-24">
            <div className="mx-auto max-w-2xl text-center">
              {/* Brand mark */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#b79a6b]/30 bg-[#b79a6b]/[0.05]">
                <span className="font-display text-xl text-[#8f7651]">
                  K
                </span>
              </div>

              <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.34em] text-[#8f7651]">
                Karta Collection
              </p>

              <h1 className="mt-5 font-display text-[3rem] font-medium leading-[0.98] tracking-[-0.045em] text-[#151b1c] sm:text-6xl">
                Your collection
                <br />
                <span className="text-[#8f7651]">is waiting.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-[#151b1c]/50">
                Your selection of considered furniture and interiors will
                appear here once you discover something worth bringing home.
              </p>

              <Link
                to="/shop"
                className="group mt-9 inline-flex h-13 items-center gap-4 rounded-full bg-[#151b1c] px-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253033] hover:shadow-[0_16px_35px_rgba(21,27,28,0.16)]"
              >
                Explore the collection

                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <div className="mx-auto mt-10 flex max-w-xs items-center justify-center gap-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/25">
                <span className="h-px w-8 bg-[#b79a6b]/40" />
                Curated for beautiful living
                <span className="h-px w-8 bg-[#b79a6b]/40" />
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f6f1] text-[#151b1c]">
      {/* ================================================================== */}
      {/* Header                                                             */}
      {/* ================================================================== */}

      <section className="relative">
        {/* Atmospheric background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 -top-56 h-[38rem] w-[38rem] rounded-full bg-[#b79a6b]/[0.065] blur-3xl"
        />

        <div className="container-x relative pb-8 pt-12 sm:pb-10 sm:pt-16 lg:pt-20">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#b79a6b]" />

                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#8f7651]">
                  Your selection
                </p>
              </div>

              <h1 className="mt-5 font-display text-[3rem] font-medium leading-none tracking-[-0.045em] text-[#151b1c] sm:text-6xl">
                Shopping bag
              </h1>

              <p className="mt-4 max-w-lg text-sm leading-6 text-[#151b1c]/45">
                A considered selection of pieces chosen for your space.
              </p>
            </div>

            {/* Item count */}
            <div className="flex items-center gap-3 self-start sm:self-end">
              <span className="flex h-9 min-w-9 items-center justify-center rounded-full border border-[#b79a6b]/30 bg-[#b79a6b]/[0.06] px-2 text-xs font-semibold text-[#8f7651]">
                {itemCount}
              </span>

              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/40">
                {itemCount === 1 ? 'piece' : 'pieces'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Main Cart Area                                                     */}
      {/* ================================================================== */}

      <section className="container-x pb-16 sm:pb-20 lg:pb-28">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-20">
          {/* ============================================================ */}
          {/* Cart Items                                                    */}
          {/* ============================================================ */}

          <div>
            {/* Column headings */}
            <div className="mb-3 hidden grid-cols-[1fr_auto] items-center px-1 sm:grid">
              <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#151b1c]/30">
                Selected pieces
              </span>

              <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#151b1c]/30">
                Total
              </span>
            </div>

            <ul className="border-y border-[#151b1c]/[0.08]">
              {lines.map(({ product: p, qty, assembly: hasAsm }, index) => (
                <li
                  key={p.id}
                  className={`group py-7 sm:py-9 ${
                    index !== 0
                      ? 'border-t border-[#151b1c]/[0.08]'
                      : ''
                  }`}
                >
                  <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-5 sm:grid-cols-[150px_minmax(0,1fr)_150px] sm:gap-7 lg:grid-cols-[165px_minmax(0,1fr)_150px]">
                    {/* -------------------------------------------------- */}
                    {/* Product image                                       */}
                    {/* -------------------------------------------------- */}

                    <Link
                      to={`/product/${p.id}`}
                      className="group/image relative block aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-[#ebe7df]"
                    >
                      <SafeImage
                        src={p.image}
                        alt={p.name}
                        fallback={`bg-gradient-to-br ${p.swatch}`}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/image:scale-[1.045]"
                      />

                      {/* Image shade */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#151b1c]/10 via-transparent to-white/[0.04]"
                      />

                      {p.tag && (
                        <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/85 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[#151b1c] shadow-sm backdrop-blur-md">
                          {p.tag}
                        </span>
                      )}
                    </Link>

                    {/* -------------------------------------------------- */}
                    {/* Product information                                 */}
                    {/* -------------------------------------------------- */}

                    <div className="flex min-w-0 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#8f7651]">
                              {p.categoryId}
                            </p>

                            <Link
                              to={`/product/${p.id}`}
                              className="block max-w-lg font-display text-xl leading-[1.08] tracking-[-0.025em] text-[#151b1c] transition-colors duration-300 hover:text-[#8f7651] sm:text-2xl"
                            >
                              {p.name}
                            </Link>

                            <p className="mt-2 text-[11px] text-[#151b1c]/40">
                              By {p.vendor.name}
                            </p>
                          </div>

                          {/* Mobile price */}
                          <p className="shrink-0 font-display text-lg font-medium tracking-[-0.02em] text-[#151b1c] sm:hidden">
                            {formatNaira(p.price * qty)}
                          </p>
                        </div>

                        <p className="mt-5 hidden max-w-md text-xs leading-6 text-[#151b1c]/40 sm:block">
                          {p.material}
                        </p>
                      </div>

                      <div className="mt-6">
                        {/* Assembly */}
                        {p.assemblyAvailable && (
                          <label
                            className={`mb-5 flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-300 ${
                              hasAsm
                                ? 'border-[#b79a6b]/30 bg-[#b79a6b]/[0.05]'
                                : 'border-[#151b1c]/[0.07] bg-white/40 hover:border-[#151b1c]/15'
                            }`}
                          >
                            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                              <input
                                type="checkbox"
                                checked={hasAsm}
                                onChange={() => toggleAssembly(p.id)}
                                className="peer h-4 w-4 cursor-pointer appearance-none rounded-full border border-[#151b1c]/20 bg-white transition-all checked:border-[#151b1c] checked:bg-[#151b1c]"
                              />

                              <Check className="pointer-events-none absolute hidden h-2.5 w-2.5 text-white peer-checked:block" />
                            </span>

                            <span className="flex-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#151b1c]/55">
                              Professional assembly
                            </span>

                            <span className="text-[10px] font-semibold text-[#8f7651]">
                              +{formatNaira(SITE.assemblyFee)}
                            </span>
                          </label>
                        )}

                        {/* Quantity / Remove */}
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 items-center rounded-full border border-[#151b1c]/10 bg-white/70">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => setQty(p.id, qty - 1)}
                              className="flex h-full w-10 items-center justify-center rounded-l-full text-[#151b1c]/40 transition-colors hover:bg-[#151b1c]/[0.04] hover:text-[#151b1c]"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <span className="w-8 text-center text-xs font-semibold text-[#151b1c]">
                              {qty}
                            </span>

                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => setQty(p.id, qty + 1)}
                              className="flex h-full w-10 items-center justify-center rounded-r-full text-[#151b1c]/40 transition-colors hover:bg-[#151b1c]/[0.04] hover:text-[#151b1c]"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(p.id)}
                            className="group/remove flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#151b1c]/30 transition-colors hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5 transition-transform duration-300 group-hover/remove:scale-90" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* -------------------------------------------------- */}
                    {/* Desktop price                                       */}
                    {/* -------------------------------------------------- */}

                    <div className="hidden text-right sm:block">
                      <p className="font-display text-xl font-medium tracking-[-0.025em] text-[#151b1c]">
                        {formatNaira(p.price * qty)}
                      </p>

                      {qty > 1 && (
                        <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#151b1c]/30">
                          {formatNaira(p.price)} each
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Continue shopping */}
            <Link
              to="/shop"
              className="group mt-7 inline-flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/40 transition-colors hover:text-[#151b1c]"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
              Continue exploring
            </Link>
          </div>

          {/* ============================================================ */}
          {/* Order Summary                                                 */}
          {/* ============================================================ */}

          <aside className="h-fit lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-[1.75rem] border border-[#151b1c]/[0.08] bg-white/80 shadow-[0_25px_70px_rgba(21,27,28,0.06)] backdrop-blur-sm">
              {/* Summary heading */}
              <div className="border-b border-[#151b1c]/[0.07] px-6 py-7 sm:px-7">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#8f7651]">
                    Karta checkout
                  </p>

                  <span className="h-px w-8 bg-[#b79a6b]/50" />
                </div>

                <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.03em] text-[#151b1c]">
                  Order summary
                </h2>
              </div>

              {/* Pricing */}
              <div className="px-6 py-7 sm:px-7">
                <dl className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-[#151b1c]/45">Subtotal</dt>
                    <dd className="font-medium text-[#151b1c]">
                      {formatNaira(subtotal)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt className="text-[#151b1c]/45">Assembly</dt>
                    <dd className="font-medium text-[#151b1c]">
                      {assembly > 0 ? formatNaira(assembly) : '—'}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-6">
                    <dt className="text-[#151b1c]/45">Delivery</dt>

                    <dd className="max-w-[150px] text-right text-[10px] leading-4 text-[#151b1c]/35">
                      Calculated and confirmed at checkout
                    </dd>
                  </div>
                </dl>

                <div className="my-7 h-px bg-[#151b1c]/[0.08]" />

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#151b1c]/30">
                      Total
                    </p>

                    <p className="mt-1 text-[10px] text-[#151b1c]/35">
                      Excluding delivery
                    </p>
                  </div>

                  <p className="font-display text-3xl font-medium tracking-[-0.04em] text-[#151b1c]">
                    {formatNaira(total)}
                  </p>
                </div>

                <Link
                  to="/checkout"
                  className="group mt-7 flex h-14 w-full items-center justify-between rounded-full bg-[#151b1c] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253033] hover:shadow-[0_14px_32px_rgba(21,27,28,0.17)]"
                >
                  <span>Proceed to checkout</span>

                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/15">
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                </Link>

                <p className="mt-4 text-center text-[9px] leading-5 text-[#151b1c]/30">
                  You’ll sign in or register securely at checkout.
                </p>
              </div>

              {/* ======================================================== */}
              {/* Assurance                                                 */}
              {/* ======================================================== */}

              <div className="border-t border-[#151b1c]/[0.07] bg-[#f5f2ec] px-6 py-6 sm:px-7">
                <p className="mb-5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#151b1c]/30">
                  The Karta standard
                </p>

                <div className="space-y-5">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#151b1c]/[0.045]">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#8f7651]" />
                    </span>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#151b1c]/65">
                        Trusted selection
                      </p>

                      <p className="mt-1 text-[10px] leading-4 text-[#151b1c]/35">
                        Every Karta vendor is reviewed through our marketplace
                        trust framework.
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-[#151b1c]/[0.06]" />

                  <div className="flex items-start gap-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#151b1c]/[0.045]">
                      <Truck className="h-3.5 w-3.5 text-[#8f7651]" />
                    </span>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#151b1c]/65">
                        Delivery coordination
                      </p>

                      <p className="mt-1 text-[10px] leading-4 text-[#151b1c]/35">
                        Delivery arrangements are confirmed during checkout.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Small reassurance beneath card */}
            <div className="mt-5 flex items-center justify-center gap-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/25">
              <span className="h-px w-5 bg-[#b79a6b]/40" />
              Considered pieces · Delivered with care
              <span className="h-px w-5 bg-[#b79a6b]/40" />
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

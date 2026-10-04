import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'

import SafeImage from '@/components/ui/SafeImage'
import {
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
  inputClass,
  primaryBtn,
} from '@/components/portal/ui'
import { formatNaira } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import { VENDOR_POLICY } from '@/modules/vendors/config'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import { STATUS_META, categoryName } from '@/modules/vendors/lib/listings'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'
import type { ListingStatus, VendorListing } from '@/modules/vendors/types'

type Filter = 'all' | ListingStatus | 'stock'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'in_review', label: 'In review' },
  { id: 'draft', label: 'Drafts' },
  { id: 'paused', label: 'Paused' },
  { id: 'stock', label: 'Stock alerts' },
]

export default function VendorProductsPage() {
  useDocumentTitle('Products')

  const { email, workspace } = useVendor()
  const { listings } = workspace

  const setStatus = useVendorStore((s) => s.setListingStatus)
  const setStock = useVendorStore((s) => s.setListingStock)
  const remove = useVendorStore((s) => s.deleteListing)

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const isAlert = (l: VendorListing) =>
    l.status === 'live' && l.stock <= VENDOR_POLICY.lowStockThreshold

  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: listings.length,
      live: 0,
      in_review: 0,
      draft: 0,
      paused: 0,
      stock: 0,
    }
    for (const l of listings) {
      base[l.status] += 1
      if (isAlert(l)) base.stock += 1
    }
    return base
  }, [listings])

  const visible = listings.filter((l) => {
    if (filter === 'stock' ? !isAlert(l) : filter !== 'all' && l.status !== filter) return false
    const q = query.trim().toLowerCase()
    return !q || l.name.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)
  })

  const act = (result: { ok: boolean; error?: string }, success: string) =>
    result.ok ? toast.success(success) : toast.error(result.error ?? 'Something went wrong.')

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Everything you sell on Karta. Drafts are private until you submit them for review."
        actions={
          <Link to="/vendor/products/new" className={primaryBtn}>
            <Plus className="h-4 w-4" /> Add product
          </Link>
        }
      />

      {listings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title="Your catalogue is empty"
            body="Add your first piece with good photos, honest dimensions and a realistic delivery window."
            action={
              <Link to="/vendor/products/new" className={primaryBtn}>
                Add your first product
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Filter products" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    filter === f.id
                      ? 'border-[#151b1c] bg-[#151b1c] text-white'
                      : 'border-[#151b1c]/15 bg-white/60 text-[#151b1c]/65 hover:border-[#151b1c]/35'
                  }`}
                >
                  {f.label} <span className="ml-1 opacity-60">{counts[f.id]}</span>
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#151b1c]/35" />
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search name or SKU"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputClass()} !h-11 pl-11`}
              />
            </div>
          </div>

          <Card>
            {visible.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-[#151b1c]/45">
                No products match this view.
              </p>
            ) : (
              <ul className="divide-y divide-[#151b1c]/[0.07]">
                {visible.map((l) => {
                  const meta = STATUS_META[l.status]
                  const low = isAlert(l)

                  return (
                    <li key={l.id} className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <SafeImage
                          src={l.images[0]}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-xl bg-[#eae5db]"
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/vendor/products/${l.id}`}
                            className="block truncate text-sm font-semibold underline-offset-4 hover:underline"
                          >
                            {l.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-[#151b1c]/45">
                            {l.sku} · {categoryName(l.categoryId)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:justify-end">
                        <span className="w-28 text-sm font-medium tabular-nums">
                          {l.price ? formatNaira(l.price) : '—'}
                        </span>

                        <StockEditor
                          key={`${l.id}-${l.stock}`}
                          value={l.stock}
                          warn={low}
                          label={`Stock for ${l.name}`}
                          onSave={(n) => act(setStock(email, l.id, n), 'Stock updated')}
                        />

                        <span className="w-24">
                          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                        </span>

                        <div className="flex gap-1">
                          <Link
                            to={`/vendor/products/${l.id}`}
                            aria-label={`Edit ${l.name}`}
                            className="rounded-full p-2 text-[#151b1c]/55 transition hover:bg-black/5 hover:text-[#151b1c]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>

                          {(l.status === 'live' || l.status === 'paused') && (
                            <button
                              type="button"
                              aria-label={l.status === 'live' ? `Pause ${l.name}` : `Resume ${l.name}`}
                              onClick={() =>
                                act(
                                  setStatus(email, l.id, l.status === 'live' ? 'paused' : 'live'),
                                  l.status === 'live' ? 'Product paused' : 'Product is live again',
                                )
                              }
                              className="rounded-full p-2 text-[#151b1c]/55 transition hover:bg-black/5 hover:text-[#151b1c]"
                            >
                              {l.status === 'live' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}

                          {(l.status === 'draft' || l.status === 'paused') && (
                            <button
                              type="button"
                              aria-label={`Delete ${l.name}`}
                              onClick={() => {
                                if (window.confirm(`Delete “${l.name}”? This can’t be undone.`)) {
                                  remove(email, l.id)
                                  toast.success('Product deleted')
                                }
                              }}
                              className="rounded-full p-2 text-[#9b302d]/70 transition hover:bg-[#9b302d]/10 hover:text-[#9b302d]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Inline stock editor                                                        */
/* -------------------------------------------------------------------------- */

function StockEditor({
  value,
  warn,
  label,
  onSave,
}: {
  value: number
  warn: boolean
  label: string
  onSave: (n: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  const commit = () => {
    const n = Number(draft)
    if (draft.trim() === '' || !Number.isInteger(n) || n < 0) {
      setDraft(String(value))
      toast.error('Stock must be a whole number, 0 or more.')
      return
    }
    if (n !== value) onSave(n)
  }

  return (
    <label className="flex w-28 items-center gap-2 text-xs text-[#151b1c]/45">
      <span className="sr-only">{label}</span>
      <input
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`h-9 w-16 rounded-lg border bg-white text-center text-sm tabular-nums outline-none focus:border-[#151b1c]/50 ${
          warn ? 'border-[#b7791f]/60 text-[#8a5a14]' : 'border-[#151b1c]/15'
        }`}
      />
      {value === 0 ? 'out' : 'in stock'}
    </label>
  )
}

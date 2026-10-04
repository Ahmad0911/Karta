import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Star, X } from 'lucide-react'

import {
  Card,
  CardHeader,
  FormField,
  Notice,
  PageHeader,
  StatusPill,
  inputClass,
  primaryBtn,
  secondaryBtn,
  textareaClass,
} from '@/components/portal/ui'
import { categories } from '@/data/categories'
import { rooms } from '@/data/rooms'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'

import { VENDOR_POLICY } from '@/modules/vendors/config'
import { FINISH_PALETTE } from '@/modules/vendors/data/reference'
import { useVendor } from '@/modules/vendors/hooks/useVendor'
import { prepareImage } from '@/lib/images'
import {
  STATUS_META,
  draftFromListing,
  emptyListingDraft,
  validateListing,
  type ListingDraft,
} from '@/modules/vendors/lib/listings'
import type { FieldErrors } from '@/modules/vendors/lib/onboarding'
import { useVendorStore } from '@/modules/vendors/store/vendor.store'

/**
 * Numeric inputs are kept as strings while typing so "", "1" and "12" all
 * behave, then converted when the form is saved.
 */
interface FormState extends Omit<
  ListingDraft,
  'price' | 'originalPrice' | 'stock' | 'deliveryMinDays' | 'deliveryMaxDays'
> {
  price: string
  originalPrice: string
  stock: string
  deliveryMinDays: string
  deliveryMaxDays: string
}

const toForm = (d: ListingDraft): FormState => ({
  ...d,
  price: d.price ? String(d.price) : '',
  originalPrice: d.originalPrice ? String(d.originalPrice) : '',
  stock: String(d.stock),
  deliveryMinDays: String(d.deliveryMinDays),
  deliveryMaxDays: String(d.deliveryMaxDays),
})

const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

const toDraft = (f: FormState): ListingDraft => ({
  ...f,
  price: num(f.price) || 0,
  originalPrice: f.originalPrice.trim() === '' ? undefined : num(f.originalPrice),
  stock: num(f.stock),
  deliveryMinDays: num(f.deliveryMinDays),
  deliveryMaxDays: num(f.deliveryMaxDays),
})

const digits = (v: string) => v.replace(/\D/g, '')

export default function VendorProductFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'

  const navigate = useNavigate()
  const { email, workspace } = useVendor()
  const saveListing = useVendorStore((s) => s.saveListing)

  const existing = isNew ? undefined : workspace.listings.find((l) => l.id === id)
  const approved = workspace.profile.status === 'approved'

  useDocumentTitle(isNew ? 'New product' : existing ? `Edit ${existing.name}` : 'Product')

  const [form, setForm] = useState<FormState>(() =>
    toForm(existing ? draftFromListing(existing) : emptyListingDraft()),
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (!isNew && !existing) return <Navigate to="/vendor/products" replace />

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  const isLiveOrPaused = existing?.status === 'live' || existing?.status === 'paused'

  const props = (key: keyof FormState) => ({
    id: `p-${key}`,
    'aria-invalid': errors[key] ? (true as const) : undefined,
    'aria-describedby': errors[key] ? `p-${key}-msg` : undefined,
  })

  /* ------------------------------- photos --------------------------------- */

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const room = VENDOR_POLICY.maxImages - form.images.length

    if (room <= 0) {
      toast.error(`You can add up to ${VENDOR_POLICY.maxImages} photos.`)
      return
    }

    setUploading(true)
    const added: string[] = []

    for (const file of Array.from(files).slice(0, room)) {
      const result = await prepareImage(file)
      if (result.ok) added.push(result.dataUrl)
      else toast.error(result.error)
    }

    if (files.length > room) {
      toast.info(`Only the first ${room} photo${room === 1 ? '' : 's'} were added.`)
    }

    if (added.length) set('images', [...form.images, ...added])
    setUploading(false)
  }

  const makeCover = (i: number) =>
    set('images', [form.images[i], ...form.images.filter((_, n) => n !== i)])

  const removePhoto = (i: number) =>
    set('images', form.images.filter((_, n) => n !== i))

  /* -------------------------------- save ---------------------------------- */

  const save = (submitForReview: boolean) => {
    const raw = toDraft(form)

    // Drafts may be incomplete, but must never store NaN.
    const draft: ListingDraft = submitForReview
      ? raw
      : {
          ...raw,
          stock: Number.isFinite(raw.stock) ? raw.stock : 0,
          deliveryMinDays: Number.isFinite(raw.deliveryMinDays) ? raw.deliveryMinDays : 1,
          deliveryMaxDays: Number.isFinite(raw.deliveryMaxDays)
            ? raw.deliveryMaxDays
            : Math.max(raw.deliveryMinDays || 1, 1),
        }

    const found = validateListing(draft, submitForReview ? 'submit' : 'draft')

    if (Object.keys(found).length > 0) {
      setErrors(found)
      toast.error('Please fix the highlighted fields.')
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }

    const result = saveListing(email, { id: existing?.id, draft, submitForReview })

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setDirty(false)
    toast.success(
      submitForReview
        ? isLiveOrPaused
          ? 'Changes saved'
          : 'Submitted for review'
        : 'Draft saved',
    )
    navigate('/vendor/products')
  }

  /* -------------------------------- render -------------------------------- */

  const discount =
    num(form.originalPrice) > num(form.price) && num(form.price) > 0
      ? Math.round((1 - num(form.price) / num(form.originalPrice)) * 100)
      : 0

  return (
    <div className="space-y-8">
      <Link
        to="/vendor/products"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"
      >
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>

      <PageHeader
        eyebrow={existing ? existing.sku : 'New piece'}
        title={isNew ? 'Add a product' : form.name || 'Edit product'}
        actions={
          existing && (
            <StatusPill tone={STATUS_META[existing.status].tone}>
              {STATUS_META[existing.status].label}
            </StatusPill>
          )
        }
      />

      {existing?.moderationNote && (
        <Notice tone="danger" title="Sent back by the Karta team">
          {existing.moderationNote}
        </Notice>
      )}

      {!approved && (
        <Notice tone="info" title="You can save drafts now">
          Submitting products for review opens up once your vendor application is
          approved.
        </Notice>
      )}

      {/* ------------------------------- Photos ------------------------------- */}
      <Card>
        <CardHeader
          title="Photos"
          description={`Up to ${VENDOR_POLICY.maxImages}. The first photo is the cover. Use natural light and a clean background.`}
        />
        <div className="p-5 sm:p-6">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.images.map((src, i) => (
              <li key={src.slice(-32) + i} className="group relative aspect-square overflow-hidden rounded-xl bg-[#eae5db]">
                <img src={src} alt={`Product photo ${i + 1}`} className="h-full w-full object-cover" />

                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#151b1c] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
                    Cover
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  {i !== 0 ? (
                    <button
                      type="button"
                      onClick={() => makeCover(i)}
                      className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold"
                    >
                      <Star className="h-3 w-3" /> Cover
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="rounded-full bg-white/90 p-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}

            {form.images.length < VENDOR_POLICY.maxImages && (
              <li>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#151b1c]/25 text-xs font-semibold text-[#151b1c]/55 transition hover:border-[#151b1c]/50 hover:bg-white disabled:opacity-50"
                >
                  <ImagePlus className="h-5 w-5" />
                  {uploading ? 'Preparing…' : 'Add photos'}
                </button>
              </li>
            )}
          </ul>

          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Upload product photos"
            onChange={(e) => {
              void addPhotos(e.target.files)
              e.target.value = ''
            }}
          />

          {errors.images && <p className="mt-3 text-xs text-[#9b302d]">{errors.images}</p>}
        </div>
      </Card>

      {/* ------------------------------- Details ------------------------------ */}
      <Card>
        <CardHeader title="Details" />
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2">
            <FormField id="p-name" label="Product name" required error={errors.name}>
              <input
                {...props('name')}
                className={inputClass(!!errors.name)}
                value={form.name}
                maxLength={80}
                placeholder="Kano Six-Seater Dining Table"
                onChange={(e) => set('name', e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="p-categoryId" label="Category" required error={errors.categoryId}>
            <select {...props('categoryId')} className={inputClass(!!errors.categoryId)} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField id="p-room" label="Room" required error={errors.room}>
            <select {...props('room')} className={inputClass(!!errors.room)} value={form.room} onChange={(e) => set('room', e.target.value)}>
              <option value="">Select a room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </FormField>

          <div className="sm:col-span-2">
            <FormField
              id="p-description"
              label="Description"
              required
              error={errors.description}
              hint={`${form.description.trim().length} characters · at least 40`}
            >
              <textarea
                {...props('description')}
                className={textareaClass(!!errors.description)}
                value={form.description}
                placeholder="How it is made, what makes it special, how to care for it."
                onChange={(e) => set('description', e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="p-material" label="Material" required error={errors.material}>
            <input {...props('material')} className={inputClass(!!errors.material)} value={form.material} placeholder="Solid oak, oiled finish" onChange={(e) => set('material', e.target.value)} />
          </FormField>

          <FormField id="p-dimensions" label="Dimensions" required error={errors.dimensions} hint="Length × width × height, in cm.">
            <input {...props('dimensions')} className={inputClass(!!errors.dimensions)} value={form.dimensions} placeholder="180 × 90 × 75 cm" onChange={(e) => set('dimensions', e.target.value)} />
          </FormField>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">
              Finishes available
            </legend>
            <div className="flex flex-wrap gap-2">
              {FINISH_PALETTE.map((c) => {
                const on = form.colors.some((x) => x.name === c.name)
                return (
                  <label
                    key={c.name}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pl-2 pr-3.5 text-xs font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#bc8e63] ${
                      on ? 'border-[#151b1c] bg-[#151b1c]/[0.04]' : 'border-[#151b1c]/15 hover:border-[#151b1c]/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() =>
                        set('colors', on ? form.colors.filter((x) => x.name !== c.name) : [...form.colors, { name: c.name, hex: c.hex }])
                      }
                    />
                    <span aria-hidden="true" className="h-4 w-4 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} />
                    {c.name}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      </Card>

      {/* ----------------------------- Price & stock -------------------------- */}
      <Card>
        <CardHeader title="Price & stock" description="Prices are in naira, whole numbers only." />
        <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
          <FormField id="p-price" label="Selling price (₦)" required error={errors.price}>
            <input {...props('price')} inputMode="numeric" className={`${inputClass(!!errors.price)} tabular-nums`} value={form.price} placeholder="420000" onChange={(e) => set('price', digits(e.target.value))} />
          </FormField>

          <FormField
            id="p-originalPrice"
            label="Original price (₦)"
            error={errors.originalPrice}
            hint={discount ? `Shows as ${discount}% off` : 'Optional. Fill in to show a discount.'}
          >
            <input {...props('originalPrice')} inputMode="numeric" className={`${inputClass(!!errors.originalPrice)} tabular-nums`} value={form.originalPrice} onChange={(e) => set('originalPrice', digits(e.target.value))} />
          </FormField>

          <FormField id="p-stock" label="Units in stock" required error={errors.stock}>
            <input {...props('stock')} inputMode="numeric" className={`${inputClass(!!errors.stock)} tabular-nums`} value={form.stock} onChange={(e) => set('stock', digits(e.target.value))} />
          </FormField>
        </div>
      </Card>

      {/* ------------------------------- Delivery ----------------------------- */}
      <Card>
        <CardHeader title="Delivery & assembly" description="Be realistic. Late deliveries lower your trust score." />
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <FormField id="p-deliveryMinDays" label="Fastest delivery (days)" required error={errors.deliveryMinDays}>
            <input {...props('deliveryMinDays')} inputMode="numeric" className={inputClass(!!errors.deliveryMinDays)} value={form.deliveryMinDays} onChange={(e) => set('deliveryMinDays', digits(e.target.value))} />
          </FormField>

          <FormField id="p-deliveryMaxDays" label="Slowest delivery (days)" required error={errors.deliveryMaxDays}>
            <input {...props('deliveryMaxDays')} inputMode="numeric" className={inputClass(!!errors.deliveryMaxDays)} value={form.deliveryMaxDays} onChange={(e) => set('deliveryMaxDays', digits(e.target.value))} />
          </FormField>

          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#151b1c]"
              checked={form.assemblyAvailable}
              onChange={(e) => set('assemblyAvailable', e.target.checked)}
            />
            <span className="text-sm">Professional assembly can be offered for this piece</span>
          </label>
        </div>
      </Card>

      {/* -------------------------------- Actions ----------------------------- */}
      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse items-stretch justify-end gap-3 border-t border-[#151b1c]/[0.08] bg-[#f7f4ee]/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:rounded-2xl sm:border sm:px-5">
        <Link to="/vendor/products" className={`${secondaryBtn} sm:mr-auto`}>
          Cancel
        </Link>

        {!isLiveOrPaused && (
          <button type="button" className={secondaryBtn} onClick={() => save(false)}>
            Save draft
          </button>
        )}

        <button
          type="button"
          className={primaryBtn}
          disabled={!approved && !isLiveOrPaused}
          onClick={() => save(true)}
        >
          {isLiveOrPaused ? 'Save changes' : 'Submit for review'}
        </button>
      </div>
    </div>
  )
}

import { categories } from '@/data/categories'
import { rooms } from '@/data/rooms'
import type { ListingStatus, VendorListing } from '../types'
import type { FieldErrors } from './onboarding'

export type ListingDraft = Omit<
  VendorListing,
  'id' | 'sku' | 'status' | 'moderationNote' | 'createdAt' | 'updatedAt'
>

export const emptyListingDraft = (): ListingDraft => ({
  name: '',
  categoryId: '',
  room: '',
  description: '',
  material: '',
  dimensions: '',
  colors: [],
  price: 0,
  originalPrice: undefined,
  stock: 0,
  deliveryMinDays: 5,
  deliveryMaxDays: 10,
  assemblyAvailable: false,
  images: [],
})

export const draftFromListing = (l: VendorListing): ListingDraft => ({
  name: l.name,
  categoryId: l.categoryId,
  room: l.room,
  description: l.description,
  material: l.material,
  dimensions: l.dimensions,
  colors: l.colors,
  price: l.price,
  originalPrice: l.originalPrice,
  stock: l.stock,
  deliveryMinDays: l.deliveryMinDays,
  deliveryMaxDays: l.deliveryMaxDays,
  assemblyAvailable: l.assemblyAvailable,
  images: l.images,
})

/** A draft only needs a name. Everything else is required to go for review. */
export function validateListing(
  d: ListingDraft,
  mode: 'draft' | 'submit',
): FieldErrors {
  const e: FieldErrors = {}

  if (d.name.trim().length < 3) e.name = 'Give the piece a name (at least 3 characters).'
  if (d.name.trim().length > 80) e.name = 'Keep the name under 80 characters.'

  if (mode === 'draft') return e

  if (!d.categoryId) e.categoryId = 'Choose a category.'
  if (!d.room) e.room = 'Choose the room it belongs in.'

  if (d.description.trim().length < 40) {
    e.description = 'Describe the piece in at least 40 characters.'
  }

  if (d.material.trim().length < 2) e.material = 'Tell customers what it is made of.'
  if (d.dimensions.trim().length < 3) e.dimensions = 'Add dimensions, for example 180 × 90 × 75 cm.'

  if (!Number.isInteger(d.price) || d.price < 1000) {
    e.price = 'Enter a price of at least ₦1,000, in whole naira.'
  }

  if (d.originalPrice !== undefined && d.originalPrice <= d.price) {
    e.originalPrice = 'The original price must be higher than the selling price.'
  }

  if (!Number.isInteger(d.stock) || d.stock < 0) {
    e.stock = 'Stock must be a whole number, 0 or more.'
  }

  if (!Number.isInteger(d.deliveryMinDays) || d.deliveryMinDays < 1) {
    e.deliveryMinDays = 'Minimum delivery time is 1 day or more.'
  }

  if (d.deliveryMaxDays < d.deliveryMinDays) {
    e.deliveryMaxDays = 'Maximum cannot be lower than the minimum.'
  }

  if (d.images.length === 0) e.images = 'Add at least one clear photo.'

  return e
}

/* -------------------------------------------------------------------------- */
/* Display helpers                                                            */
/* -------------------------------------------------------------------------- */

export const STATUS_META: Record<
  ListingStatus,
  { label: string; tone: 'neutral' | 'amber' | 'green' | 'red' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'amber' },
  live: { label: 'Live', tone: 'green' },
  paused: { label: 'Paused', tone: 'neutral' },
}

export const categoryName = (id: string) =>
  categories.find((c) => c.id === id)?.name ?? '—'

export const roomName = (id: string) =>
  rooms.find((r) => r.id === id)?.name ?? '—'

export function makeSku(name: string, existing: string[]): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.slice(0, 3))
      .join('-') || 'ITEM'

  let n = existing.length + 1
  let sku = `KRT-${base}-${String(n).padStart(3, '0')}`

  while (existing.includes(sku)) {
    n += 1
    sku = `KRT-${base}-${String(n).padStart(3, '0')}`
  }

  return sku
}

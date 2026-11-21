import { useEffect, useMemo } from 'react'
import { create } from 'zustand'

import { apiGet } from '@/lib/api'
import { summarize } from '@/modules/reviews/lib'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import type { Product, ProductColor } from '@/types'

/**
 * Storefront catalogue from the Karta API (production). The server decides what is sellable:
 * only live products from approved vendors, and a made-for-you piece only for its own customer.
 */
interface ApiListing {
  id: string
  name: string
  categoryId: string
  room: string
  material: string
  dimensions: string
  colors: ProductColor[]
  priceKobo: number
  originalPriceKobo: number | null
  stock: number
  deliveryMinDays: number
  deliveryMaxDays: number
  assemblyAvailable: boolean
  images: string[]
  vendor: { id: string; name: string; trustScore: number }
  custom: boolean
}

const FALLBACK_SWATCH = 'from-[#d8cbb5] to-[#a89373]'

export const toProduct = (l: ApiListing): Product => ({
  id: l.id,
  name: l.name,
  categoryId: l.categoryId,
  room: l.room,
  price: Math.round(l.priceKobo / 100),
  originalPrice: l.originalPriceKobo ? Math.round(l.originalPriceKobo / 100) : undefined,
  vendor: { id: l.vendor.id, name: l.vendor.name, trustScore: l.vendor.trustScore },
  rating: 0,
  reviewCount: 0,
  material: l.material,
  dimensions: l.dimensions,
  colors: l.colors.length ? l.colors : undefined,
  deliveryEstimateDays: [l.deliveryMinDays, l.deliveryMaxDays],
  assemblyAvailable: l.assemblyAvailable,
  inStock: l.stock > 0,
  swatch: FALLBACK_SWATCH,
  image: l.images[0],
})

interface State {
  products: Product[]
  /** Everything we know by id, including made-for-you pieces that never appear in browsing. */
  byId: Record<string, Product>
  status: 'idle' | 'loading' | 'ready' | 'error'
  load: (force?: boolean) => Promise<void>
  fetchOne: (id: string) => Promise<void>
}

const asked = new Set<string>()

export const useRemoteCatalogStore = create<State>()((set, get) => ({
  products: [],
  byId: {},
  status: 'idle',

  load: async (force = false) => {
    if (!force && (get().status === 'loading' || get().status === 'ready')) return
    set({ status: 'loading' })
    try {
      const all: Product[] = []
      for (let page = 1; page <= 10; page++) {
        const r = await apiGet<{ total: number; listings: ApiListing[] }>(`/catalog?pageSize=100&page=${page}`)
        all.push(...r.listings.map(toProduct))
        if (all.length >= r.total || r.listings.length === 0) break
      }
      set((s) => ({ products: all, byId: { ...s.byId, ...Object.fromEntries(all.map((p) => [p.id, p])) }, status: 'ready' }))
    } catch {
      set({ status: 'error' })
    }
  },

  /** For a link straight to a product, a cart item, or a piece made for the signed-in customer. */
  fetchOne: async (id) => {
    if (asked.has(id) || get().byId[id]) return
    asked.add(id)
    try {
      const p = toProduct(await apiGet<ApiListing>(`/catalog/${encodeURIComponent(id)}`))
      set((s) => ({ byId: { ...s.byId, [id]: p } }))
    } catch {
      /* not found: the page shows its own "not found" */
    }
  },
}))

export function useRemoteCatalog() {
  const { products, byId, status, load, fetchOne } = useRemoteCatalogStore()
  const reviews = useReviewsStore((s) => s.reviews)

  useEffect(() => { void load() }, [load])

  return useMemo(() => {
    const withReviews = (p: Product): Product => {
      const sum = summarize(reviews.filter((r) => r.target === 'vendor' && r.targetId === p.vendor.id))
      return { ...p, rating: Math.round(sum.average * 10) / 10, reviewCount: sum.count }
    }
    return {
      products: products.map(withReviews),
      status,
      getProduct: (id: string) => {
        const p = byId[id]
        if (!p) { setTimeout(() => void fetchOne(id), 0); return undefined }
        return withReviews(p)
      },
      ownerEmail: (_id: string) => undefined as string | undefined,
    }
  }, [products, byId, status, reviews, fetchOne])
}

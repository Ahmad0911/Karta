import { uuid } from '@/lib/id'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { safeStorage } from '@/lib/safeStorage'
import { useAuthStore } from '@/store/auth.store'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { vendorIdFor } from '@/modules/catalog/vendorId'
import type { Review, ReviewTarget } from './types'

/* -------------------------------------------------------------------------- */
/* Reviews (MOCK of the reviews service)                                      */
/* -------------------------------------------------------------------------- */
/**
 * Integrity rules (the server must enforce the same):
 *  - Only the buyer of a DELIVERED order can review, once per order and target.
 *  - Reviews can't be edited by the vendor; vendors may reply once.
 *  - Only staff can hide a review, and a reason is recorded.
 */

type Result = { ok: true } | { ok: false; error: string }

export const REVIEW_LIMITS = { minBody: 10, maxBody: 1000 } as const

interface ReviewsState {
  reviews: Review[]

  submit: (input: {
    orderId: string
    target: ReviewTarget
    targetId: string
    rating: number
    body: string
  }) => Result

  reply: (reviewId: string, body: string) => Result
  setHidden: (reviewId: string, hidden: boolean, reason?: string) => Result

  devLoadSamples: () => void
  devClearSamples: () => void
}

const now = () => new Date().toISOString()

const isStaff = () => {
  const u = useAuthStore.getState().user
  return Boolean(u && (u.role === 'admin' || u.role === 'super_admin'))
}

export const useReviewsStore = create<ReviewsState>()(
  persist(
    (set, get) => ({
      reviews: [],

      submit: ({ orderId, target, targetId, rating, body }) => {
        const user = useAuthStore.getState().user
        if (!user) return { ok: false, error: 'Please sign in to leave a review.' }

        const order = useOrdersStore.getState().orders.find((o) => o.id === orderId)
        if (!order || order.customerEmail !== user.email.trim().toLowerCase()) {
          return { ok: false, error: 'You can only review orders you placed.' }
        }
        if (order.status !== 'delivered') {
          return { ok: false, error: 'You can review once your order has been delivered.' }
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return { ok: false, error: 'Choose a rating from 1 to 5 stars.' }
        }

        const text = body.trim()
        if (text.length < REVIEW_LIMITS.minBody) {
          return { ok: false, error: `Please write at least ${REVIEW_LIMITS.minBody} characters so others can learn from it.` }
        }
        if (text.length > REVIEW_LIMITS.maxBody) {
          return { ok: false, error: `Keep your review under ${REVIEW_LIMITS.maxBody} characters.` }
        }

        // The target must really have been part of this order.
        let targetName = ''
        if (target === 'vendor') {
          const line = order.lines.find((l) => l.vendorId === targetId)
          if (!line) return { ok: false, error: 'That vendor wasn’t part of this order.' }
          targetName = line.vendorName
        } else {
          if (order.courier.id !== targetId) return { ok: false, error: 'That delivery partner wasn’t part of this order.' }
          targetName = order.courier.name
        }

        if (get().reviews.some((r) => r.orderId === orderId && r.target === target && r.targetId === targetId)) {
          return { ok: false, error: 'You’ve already reviewed this order.' }
        }

        const [first, ...rest] = user.name.trim().split(/\s+/)
        const authorLabel = rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first

        const review: Review = {
          id: `rev_${uuid().slice(0, 8)}`,
          target,
          targetId,
          targetName,
          orderId,
          authorEmail: user.email.trim().toLowerCase(),
          authorLabel,
          rating: rating as Review['rating'],
          body: text,
          createdAt: now(),
          status: 'published',
        }

        set((s) => ({ reviews: [review, ...s.reviews] }))
        return { ok: true }
      },

      reply: (reviewId, body) => {
        const user = useAuthStore.getState().user
        const review = get().reviews.find((r) => r.id === reviewId)
        if (!user || !review) return { ok: false, error: 'Review not found.' }

        // Only the reviewed vendor (or staff) may reply.
        const ownsIt = review.target === 'vendor' && vendorIdFor(user.email) === review.targetId
        if (!ownsIt && !isStaff()) return { ok: false, error: 'Only the reviewed vendor can reply.' }
        if (review.reply) return { ok: false, error: 'You’ve already replied to this review.' }

        const text = body.trim()
        if (text.length < 5 || text.length > 600) {
          return { ok: false, error: 'Replies should be between 5 and 600 characters.' }
        }

        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === reviewId ? { ...r, reply: { body: text, at: now() } } : r)),
        }))
        return { ok: true }
      },

      setHidden: (reviewId, hidden, reason) => {
        if (!isStaff()) return { ok: false, error: 'Only Karta staff can moderate reviews.' }

        if (hidden && (reason ?? '').trim().length < 5) {
          return { ok: false, error: 'Record why this review is being hidden.' }
        }

        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.id === reviewId
              ? { ...r, status: hidden ? 'hidden' : 'published', hiddenReason: hidden ? reason?.trim() : undefined }
              : r,
          ),
        }))
        return { ok: true }
      },

      devLoadSamples: () => {
        const make = (
          n: number,
          target: ReviewTarget,
          targetId: string,
          targetName: string,
          rating: number,
          author: string,
          body: string,
          daysAgo: number,
        ): Review => ({
          id: `sample_${targetId}_${n}`,
          target,
          targetId,
          targetName,
          orderId: `sample_order_${targetId}_${n}`,
          authorEmail: `sample${n}@example.test`,
          authorLabel: author,
          rating: rating as Review['rating'],
          body,
          createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
          status: 'published',
          sample: true,
        })

        const V = [
          ['v1', 'Ade & Sons Woodworks', [[5, 'Chidinma O.', 'The sofa arrived exactly as pictured and the craftsmanship is superb.', 12], [5, 'Tunde A.', 'Communication was prompt and delivery was on the day promised.', 20], [4, 'Halima B.', 'Beautiful finish. One leg needed a small adjustment but they fixed it quickly.', 31], [5, 'Emeka N.', 'Third piece I have bought from them. Never disappointed.', 44]]],
          ['v2', 'Nsukka Craft House', [[5, 'Ngozi E.', 'Solid oak, heavy and beautifully oiled. Worth every naira.', 9], [4, 'Yusuf M.', 'Lovely bed frame. Delivery took two days longer than estimated.', 25], [5, 'Folake S.', 'Honest vendor, accurate photos.', 38]]],
          ['v3', 'Abuja Living Co.', [[4, 'Ifeanyi K.', 'Good quality for the price.', 15], [3, 'Amina G.', 'Nice product but the packaging was damaged.', 33]]],
          ['v4', 'Zuri Interiors', [[3, 'Seyi D.', 'Chair is fine but colour was slightly different from the photo.', 18]]],
        ] as const

        const samples: Review[] = []
        for (const [id, name, list] of V) {
          list.forEach(([rating, author, body, days], i) =>
            samples.push(make(i + 1, 'vendor', id, name, rating, author, body, days)),
          )
        }

        const logistics: [number, string, string, number][] = [
          [5, 'Chidinma O.', 'Driver called ahead and handled the sofa with care.', 12],
          [5, 'Ngozi E.', 'On time, polite, and helped place the table.', 9],
          [4, 'Yusuf M.', 'Good service, slightly late.', 25],
        ]
        logistics.forEach(([r, a, b, d], i) =>
          samples.push(make(i + 1, 'logistics', 'karta-logistics', 'Karta Delivery', r, a, b, d)),
        )

        set((s) => ({ reviews: [...samples, ...s.reviews.filter((r) => !r.sample)] }))
      },

      devClearSamples: () => set((s) => ({ reviews: s.reviews.filter((r) => !r.sample) })),
    }),
    { name: 'karta-reviews', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

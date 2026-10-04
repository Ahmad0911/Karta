import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { safeStorage } from '@/lib/safeStorage'
import { NEXT_STEP, canComplete, canFail } from '../lib/deliveries'
import type {
  Delivery,
  FailureReason,
  LogisticsWorkspace,
  ProofOfDelivery,
} from '../types'
import { buildDemoDeliveries } from './demo'

/* -------------------------------------------------------------------------- */
/* Karta logistics workspace (MOCK)                                           */
/* -------------------------------------------------------------------------- */
/**
 * Deliveries assigned to one driver, keyed by account email.
 *
 * MOCK: jobs are assigned by Karta operations and the delivery code is
 * verified by the server. Replace every action with an API call (BRD §14).
 */

export type Result = { ok: true } | { ok: false; error: string }

interface LogisticsState {
  byEmail: Record<string, LogisticsWorkspace>

  advance: (email: string, id: string) => Result
  complete: (
    email: string,
    id: string,
    input: { code: string; recipientName: string; note?: string; photo?: string },
  ) => Result
  fail: (email: string, id: string, reason: FailureReason, note: string) => Result

  devLoadDemo: (email: string) => void
  devReset: (email: string) => void
}

const now = () => new Date().toISOString()
const key = (email: string) => email.trim().toLowerCase()

export const useLogisticsStore = create<LogisticsState>()(
  persist(
    (set, get) => {
      const find = (email: string, id: string) =>
        get().byEmail[key(email)]?.deliveries.find((d) => d.id === id)

      const update = (email: string, id: string, fn: (d: Delivery) => Delivery) =>
        set((state) => {
          const k = key(email)
          const ws = state.byEmail[k]
          if (!ws) return state
          return {
            byEmail: {
              ...state.byEmail,
              [k]: { deliveries: ws.deliveries.map((d) => (d.id === id ? fn(d) : d)) },
            },
          }
        })

      return {
        byEmail: {},

        advance: (email, id) => {
          const d = find(email, id)
          if (!d) return { ok: false, error: 'Delivery not found.' }

          const step = NEXT_STEP[d.status]
          if (!step) return { ok: false, error: 'There is no next step for this delivery.' }

          update(email, id, (x) => ({
            ...x,
            status: step.to,
            // A retry clears the previous failure so the card reads cleanly.
            ...(x.status === 'failed' ? { failureReason: undefined, failureNote: undefined } : {}),
            events: [...x.events, { status: step.to, at: now() }],
          }))

          return { ok: true }
        },

        complete: (email, id, input) => {
          const d = find(email, id)
          if (!d) return { ok: false, error: 'Delivery not found.' }
          if (!canComplete(d.status)) {
            return { ok: false, error: 'Mark the delivery as arrived before completing it.' }
          }

          if (input.recipientName.trim().length < 2) {
            return { ok: false, error: 'Enter the name of the person who received the item.' }
          }

          // MOCK verification. The real check happens on the server.
          if (input.code.trim() !== d.deliveryCode) {
            return { ok: false, error: 'That code doesn’t match. Ask the customer to check their SMS.' }
          }

          const proof: ProofOfDelivery = {
            recipientName: input.recipientName.trim(),
            note: input.note?.trim() || undefined,
            photo: input.photo,
            deliveredAt: now(),
          }

          update(email, id, (x) => ({
            ...x,
            status: 'delivered',
            attempts: x.attempts + 1,
            proof,
            failureReason: undefined,
            failureNote: undefined,
            events: [...x.events, { status: 'delivered', at: proof.deliveredAt }],
          }))

          return { ok: true }
        },

        fail: (email, id, reason, note) => {
          const d = find(email, id)
          if (!d) return { ok: false, error: 'Delivery not found.' }
          if (!canFail(d.status)) {
            return { ok: false, error: 'This delivery can’t be marked as failed right now.' }
          }

          const trimmed = note.trim()
          if (reason === 'other' && trimmed.length < 5) {
            return { ok: false, error: 'Please describe what happened.' }
          }

          update(email, id, (x) => ({
            ...x,
            status: 'failed',
            attempts: x.attempts + 1,
            failureReason: reason,
            failureNote: trimmed || undefined,
            events: [...x.events, { status: 'failed', at: now(), note: trimmed || undefined }],
          }))

          return { ok: true }
        },

        devLoadDemo: (email) =>
          set((state) => ({
            byEmail: {
              ...state.byEmail,
              [key(email)]: { deliveries: buildDemoDeliveries() },
            },
          })),

        devReset: (email) =>
          set((state) => {
            const rest = { ...state.byEmail }
            delete rest[key(email)]
            return { byEmail: rest }
          }),
      }
    },
    {
      name: 'karta-logistics',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
)

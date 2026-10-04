import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { uuid } from '@/lib/id'
import { safeStorage } from '@/lib/safeStorage'
import { validateAddress } from '@/modules/orders/orders.store'
import type { DeliveryAddress } from '@/modules/orders/types'

/* -------------------------------------------------------------------------- */
/* Personal preferences (MOCK of the customer profile service)                */
/* -------------------------------------------------------------------------- */

export const MAX_ADDRESSES = 5

export interface SavedAddress extends DeliveryAddress {
  id: string
  /** "Home", "Office"… */
  label: string
  isDefault: boolean
}

export interface NotificationPrefs {
  /** Delivery progress and order status. */
  orderUpdates: { email: boolean; sms: boolean; whatsapp: boolean }
  /** Offers and new collections. OFF unless the customer opts in. */
  promotions: boolean
}

export const DEFAULT_PREFS: NotificationPrefs = {
  orderUpdates: { email: true, sms: true, whatsapp: false },
  promotions: false,
}

interface Profile {
  addresses: SavedAddress[]
  notifications: NotificationPrefs
}

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fields?: Record<string, string> }

interface ProfileState {
  byEmail: Record<string, Profile>

  saveAddress: (
    email: string,
    input: DeliveryAddress & { id?: string; label: string; makeDefault?: boolean },
  ) => Result<SavedAddress>
  removeAddress: (email: string, id: string) => void
  setDefaultAddress: (email: string, id: string) => void
  setNotifications: (email: string, prefs: NotificationPrefs) => void
  erase: (email: string) => void
}

const key = (email: string) => email.trim().toLowerCase()
const EMPTY: Profile = { addresses: [], notifications: DEFAULT_PREFS }

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => {
      const read = (email: string): Profile => get().byEmail[key(email)] ?? EMPTY
      const write = (email: string, p: Profile) =>
        set((s) => ({ byEmail: { ...s.byEmail, [key(email)]: p } }))

      return {
        byEmail: {},

        saveAddress: (email, { id, label, makeDefault, ...address }) => {
          const fields = validateAddress(address)
          if (label.trim().length < 2) fields.label = 'Give this address a short name, for example Home.'
          if (Object.keys(fields).length > 0) {
            return { ok: false, error: 'Please check the highlighted fields.', fields }
          }

          const p = read(email)
          const existing = id ? p.addresses.find((a) => a.id === id) : undefined
          if (id && !existing) return { ok: false, error: 'Address not found.' }

          if (!existing && p.addresses.length >= MAX_ADDRESSES) {
            return { ok: false, error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.` }
          }

          // The first address is always the default.
          const isDefault = makeDefault || existing?.isDefault || p.addresses.length === 0

          const saved: SavedAddress = {
            ...address,
            fullName: address.fullName.trim(),
            street: address.street.trim(),
            city: address.city.trim(),
            landmark: address.landmark?.trim() || undefined,
            id: existing?.id ?? uuid(),
            label: label.trim(),
            isDefault,
          }

          const others = p.addresses
            .filter((a) => a.id !== saved.id)
            .map((a) => (isDefault ? { ...a, isDefault: false } : a))

          write(email, {
            ...p,
            addresses: existing
              ? p.addresses.map((a) => (a.id === saved.id ? saved : isDefault ? { ...a, isDefault: false } : a))
              : [...others, saved],
          })

          return { ok: true, data: saved }
        },

        removeAddress: (email, id) => {
          const p = read(email)
          const remaining = p.addresses.filter((a) => a.id !== id)
          // If the default was removed, promote the first remaining address.
          if (remaining.length && !remaining.some((a) => a.isDefault)) remaining[0] = { ...remaining[0], isDefault: true }
          write(email, { ...p, addresses: remaining })
        },

        setDefaultAddress: (email, id) => {
          const p = read(email)
          write(email, { ...p, addresses: p.addresses.map((a) => ({ ...a, isDefault: a.id === id })) })
        },

        setNotifications: (email, prefs) => write(email, { ...read(email), notifications: prefs }),

        erase: (email) =>
          set((s) => {
            const rest = { ...s.byEmail }
            delete rest[key(email)]
            return { byEmail: rest }
          }),
      }
    },
    { name: 'karta-profile', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
)

/** Stable empty profile for signed-out or brand-new users. */
export const selectProfile = (email: string | undefined) => (s: ProfileState): Profile =>
  (email && s.byEmail[key(email)]) || EMPTY

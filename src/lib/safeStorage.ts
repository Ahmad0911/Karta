import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage that never throws.
 *
 * Browsers throw when storage is full, blocked (private mode) or disabled.
 * A throw inside a zustand `persist` write would break the action that
 * triggered it, so failures are swallowed and reported through an event the
 * UI can listen to instead.
 */
export const STORAGE_FULL_EVENT = 'karta:storage-full'

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },

  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      window.dispatchEvent(new CustomEvent(STORAGE_FULL_EVENT, { detail: name }))
    }
  },

  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* nothing to do */
    }
  },
}

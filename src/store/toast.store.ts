import { uuid } from '@/lib/id'
import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  tone: ToastTone
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

const LIFETIME_MS = 4500

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  push: (message, tone = 'success') => {
    const id = uuid()

    // Keep at most 4 on screen; drop the oldest.
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }].slice(-4) }))

    window.setTimeout(() => get().dismiss(id), LIFETIME_MS)
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative helper for use outside components. */
export const toast = {
  success: (m: string) => useToastStore.getState().push(m, 'success'),
  error: (m: string) => useToastStore.getState().push(m, 'error'),
  info: (m: string) => useToastStore.getState().push(m, 'info'),
}

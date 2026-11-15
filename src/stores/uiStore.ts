import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

export type ToastInput = Omit<Toast, 'id'>

interface UIState {
  sidebarCollapsed: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  pushToast: (toast: ToastInput) => void
  dismissToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toasts: [],

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  pushToast: (toast) =>
    set((state) => {
      // Cegah penumpukan notifikasi identik yang sudah tampil
      const duplicate = state.toasts.some(
        (t) =>
          t.title === toast.title &&
          t.description === toast.description &&
          t.variant === toast.variant
      )
      if (duplicate) return state

      // Batasi maksimal 4 toast aktif agar tidak menutupi layar
      const trimmed = state.toasts.length >= 4 ? state.toasts.slice(-3) : state.toasts
      return {
        toasts: [
          ...trimmed,
          { ...toast, id: crypto.randomUUID() },
        ],
      }
    }),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

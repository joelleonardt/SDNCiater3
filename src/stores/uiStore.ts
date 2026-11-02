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
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: crypto.randomUUID() },
      ],
    })),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

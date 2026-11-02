import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '@/stores/uiStore'
import ToastItem from './ToastItem'

/**
 * Provider yang merender semua toast aktif di sudut kanan atas layar.
 *
 * Letakkan di dalam `<App>` (atau AppShell) agar portal selalu tersedia.
 * Posisi: top-right (Requirements 14.1, 14.9)
 *
 * Requirements: 14.1, 14.2, 14.9
 */
export default function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts)
  const dismissToast = useUIStore((s) => s.dismissToast)

  const handleDismiss = useCallback(
    (id: string) => {
      dismissToast(id)
    },
    [dismissToast]
  )

  if (toasts.length === 0) return null

  return createPortal(
    <div
      aria-label="Notifikasi"
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2 sm:right-6 sm:top-6"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={handleDismiss}
        />
      ))}
    </div>,
    document.body
  )
}

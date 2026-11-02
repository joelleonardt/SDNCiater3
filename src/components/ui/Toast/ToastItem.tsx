import { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Toast } from '@/stores/uiStore'

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

/**
 * Komponen individual toast.
 *
 * - variant "success": auto-dismiss setelah 4 detik, ikon CheckCircle hijau
 * - variant "destructive" / error: persist sampai user close, ikon XCircle merah
 * - Perbedaan ikon dan warna memungkinkan user membedakan tanpa membaca teks
 *
 * Requirements: 14.1, 14.2, 14.9
 */
export default function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSuccess = toast.variant === 'success'
  const isError = toast.variant === 'destructive'

  // Auto-dismiss hanya untuk success toast (4 detik) - Requirements 14.1
  useEffect(() => {
    if (isSuccess) {
      timerRef.current = setTimeout(() => {
        onDismiss(toast.id)
      }, 4000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isSuccess, toast.id, onDismiss])

  return (
    <div
      role="alert"
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg',
        'animate-in slide-in-from-right-5 fade-in-0 duration-300',
        isSuccess && 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
        isError && 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
        !isSuccess && !isError && 'border-border bg-background text-foreground'
      )}
    >
      {/* Ikon — berbeda secara bentuk dan warna (Requirements 14.9) */}
      <div className="mt-0.5 shrink-0" aria-hidden="true">
        {isSuccess && (
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        )}
        {isError && (
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        )}
        {!isSuccess && !isError && (
          <CheckCircle className="h-5 w-5 text-foreground" />
        )}
      </div>

      {/* Konten */}
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="text-sm leading-snug opacity-80">{toast.description}</p>
        )}
      </div>

      {/* Tombol close — selalu tampil untuk error, opsional untuk success (Requirements 14.2) */}
      {(isError || !isSuccess) && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Tutup notifikasi"
          className={cn(
            'ml-auto shrink-0 rounded p-0.5 transition-opacity hover:opacity-70 focus:outline-none focus:ring-2',
            isSuccess && 'focus:ring-green-500',
            isError && 'focus:ring-red-500',
            !isSuccess && !isError && 'focus:ring-ring'
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

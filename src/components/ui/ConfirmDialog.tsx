import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  /** Apakah dialog terbuka */
  open: boolean
  /** Nama record yang akan dihapus — ditampilkan di pesan konfirmasi */
  recordName?: string
  /** Pesan kustom. Jika tidak disediakan, akan menggunakan pesan default. */
  message?: string
  /** Dipanggil saat user mengklik tombol "Hapus" */
  onConfirm: () => void
  /** Dipanggil saat user mengklik tombol "Batal" atau menutup dialog */
  onCancel: () => void
  /** Teks kustom untuk tombol konfirmasi (default: "Hapus") */
  confirmLabel?: string
  /** Apakah aksi konfirmasi sedang diproses */
  isLoading?: boolean
}

/**
 * Dialog konfirmasi penghapusan data.
 *
 * Dibangun dengan HTML native + Tailwind (tidak memerlukan @radix-ui/react-dialog)
 * untuk menghindari ketergantungan paket yang belum terinstall.
 *
 * - Tombol "Hapus" (destructive) dan "Batal"
 * - Klik backdrop atau tekan Escape untuk membatalkan
 * - Focus trap: fokus ke tombol "Batal" saat dialog terbuka
 *
 * Requirements: 14.4
 */
export default function ConfirmDialog({
  open,
  recordName,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Hapus',
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null)

  // Fokus ke tombol "Batal" saat dialog terbuka (aksesibilitas)
  React.useEffect(() => {
    if (open) {
      // Slight delay agar dialog selesai render sebelum fokus
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Tutup saat tekan Escape
  React.useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  // Cegah scroll background saat dialog terbuka
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const defaultMessage = recordName
    ? `Apakah Anda yakin ingin menghapus "${recordName}"? Tindakan ini tidak dapat dibatalkan.`
    : 'Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        // Tutup jika klik tepat di backdrop (bukan isi dialog)
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      {/* Dialog panel */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className={cn(
          'w-full max-w-md rounded-lg border border-border bg-background shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        // Cegah klik di dalam panel menutup dialog
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"
            aria-hidden="true"
          >
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              Konfirmasi Hapus
            </h2>
            <p
              id="confirm-dialog-description"
              className="text-sm text-muted-foreground"
            >
              {message ?? defaultMessage}
            </p>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Menghapus…
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

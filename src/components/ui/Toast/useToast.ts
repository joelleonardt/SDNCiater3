import { useUIStore, type ToastInput } from '@/stores/uiStore'

/**
 * Hook untuk menampilkan toast notifikasi dari mana saja di aplikasi.
 *
 * Contoh penggunaan:
 * ```tsx
 * const { toastSuccess, toastError } = useToast()
 *
 * // Toast sukses — auto-dismiss 4 detik
 * toastSuccess('Data berhasil disimpan')
 * toastSuccess('Data berhasil disimpan', 'Perubahan telah tersimpan ke database')
 *
 * // Toast error — persist sampai user close
 * toastError('Gagal menyimpan data')
 * toastError('Gagal menyimpan data', 'Terjadi kesalahan jaringan. Coba lagi.')
 * ```
 *
 * Requirements: 14.1, 14.2
 */
export function useToast() {
  const pushToast = useUIStore((s) => s.pushToast)
  const dismissToast = useUIStore((s) => s.dismissToast)

  /**
   * Tampilkan toast sukses.
   * Auto-dismiss setelah 4 detik. Ikon CheckCircle hijau. (Requirements 14.1, 14.9)
   */
  function toastSuccess(title: string, description?: string) {
    pushToast({ title, description, variant: 'success' })
  }

  /**
   * Tampilkan toast error.
   * Persist sampai user close. Ikon XCircle merah. (Requirements 14.2, 14.9)
   */
  function toastError(title: string, description?: string) {
    pushToast({ title, description, variant: 'destructive' })
  }

  /**
   * Tampilkan toast kustom dengan konfigurasi penuh.
   */
  function toast(input: ToastInput) {
    pushToast(input)
  }

  return { toast, toastSuccess, toastError, dismissToast }
}

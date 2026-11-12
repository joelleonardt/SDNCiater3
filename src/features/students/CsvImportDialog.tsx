import * as React from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CsvImportDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Dialog placeholder untuk fitur Impor CSV Siswa.
 * Requirements: 6.8
 */
export default function CsvImportDialog({ open, onClose }: CsvImportDialogProps) {
  React.useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 id="csv-import-title" className="text-base font-semibold text-foreground">
              Impor CSV Siswa
            </h2>
            <p className="text-sm text-muted-foreground">
              Fitur impor massal data siswa melalui berkas CSV akan tersedia pada pembaruan mendatang.
              Saat ini, silakan gunakan tombol <strong>Tambah Siswa</strong> untuk mendaftarkan siswa baru.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            Mengerti
          </Button>
        </div>
      </div>
    </div>
  )
}

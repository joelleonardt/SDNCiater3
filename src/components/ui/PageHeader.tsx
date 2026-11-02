import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  /** Judul utama halaman */
  title: string
  /** Deskripsi singkat di bawah judul (opsional) */
  description?: string
  /** Konten tambahan di sisi kanan, contoh: tombol aksi */
  actions?: React.ReactNode
  /** ClassName tambahan untuk elemen wrapper */
  className?: string
}

/**
 * Komponen header halaman yang konsisten.
 *
 * Menampilkan:
 * - Judul halaman (h1)
 * - Deskripsi opsional
 * - Area aksi opsional di sisi kanan (contoh: tombol "Tambah Data")
 *
 * Digunakan di semua halaman fitur untuk keseragaman tampilan.
 */
export default function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      {/* Judul + deskripsi */}
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Area aksi */}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

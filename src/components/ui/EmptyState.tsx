import { type LucideIcon, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Judul / pesan utama Bahasa Indonesia */
  title?: string
  /** Pesan deskripsi tambahan atau petunjuk cara menambah data pertama */
  description?: string
  /** Ikon dari lucide-react. Default: Inbox */
  icon?: LucideIcon
  /** Aksi opsional, misal tombol "Tambah Data" */
  action?: React.ReactNode
  className?: string
}

/**
 * Komponen empty-state untuk menampilkan ilustrasi dan pesan saat list kosong.
 *
 * Requirements 14.6: Tampilkan ilustrasi + pesan Bahasa Indonesia yang menjelaskan
 * mengapa list kosong atau cara menambah data pertama.
 *
 * Penggunaan:
 * ```tsx
 * <EmptyState
 *   title="Belum ada data siswa"
 *   description="Klik tombol 'Tambah Siswa' untuk menambahkan siswa pertama."
 *   action={<Button onClick={onAdd}>Tambah Siswa</Button>}
 * />
 * ```
 *
 * Requirements: 14.6
 */
export default function EmptyState({
  title = 'Belum ada data',
  description = 'Belum ada data yang tersedia saat ini.',
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center',
        className
      )}
    >
      {/* Ilustrasi — ikon besar dengan lingkaran latar */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Icon className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
      </div>

      {/* Teks */}
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Aksi opsional */}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

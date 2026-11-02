import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SkeletonTableProps {
  /** Jumlah kolom yang diharapkan pada tabel asli */
  columns?: number
  /** Jumlah baris skeleton yang ditampilkan */
  rows?: number
  /** Apakah sedang dalam state loading */
  isLoading?: boolean
  /** Delay sebelum skeleton muncul (ms). Default 300ms — Requirements 14.5 */
  delay?: number
  className?: string
}

/**
 * Komponen skeleton loading untuk tabel.
 *
 * Mematuhi Requirements 14.5: skeleton muncul setelah loading > 300ms,
 * dengan jumlah kolom dan baris sesuai layout tabel yang diharapkan.
 *
 * Penggunaan:
 * ```tsx
 * <SkeletonTable isLoading={isLoading} columns={5} rows={10} />
 * ```
 *
 * Requirements: 14.5
 */
export default function SkeletonTable({
  columns = 4,
  rows = 5,
  isLoading = true,
  delay = 300,
  className,
}: SkeletonTableProps) {
  // Sembunyikan skeleton sebelum delay berlalu (Requirements 14.5: >300ms)
  const [visible, setVisible] = useState(delay === 0)

  useEffect(() => {
    if (!isLoading) {
      setVisible(false)
      return
    }
    if (delay === 0) {
      setVisible(true)
      return
    }
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [isLoading, delay])

  if (!isLoading || !visible) return null

  return (
    <div
      role="status"
      aria-label="Memuat data..."
      className={cn('w-full overflow-hidden rounded-md border border-border', className)}
    >
      {/* Header row */}
      <div className="flex gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-4 flex-1 animate-pulse rounded bg-muted"
            style={{ maxWidth: i === 0 ? '120px' : undefined }}
            aria-hidden="true"
          />
        ))}
        {/* Actions column stub */}
        <div className="h-4 w-16 animate-pulse rounded bg-muted" aria-hidden="true" />
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={cn(
            'flex items-center gap-4 px-4 py-3',
            rowIdx < rows - 1 && 'border-b border-border'
          )}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className={cn(
                'h-4 flex-1 animate-pulse rounded bg-muted',
                // Variasikan lebar sedikit untuk terlihat lebih natural
                colIdx % 3 === 0 && 'max-w-[140px]',
                colIdx % 3 === 1 && 'max-w-[100px]',
              )}
              aria-hidden="true"
            />
          ))}
          {/* Actions column stub */}
          <div className="flex w-16 gap-1" aria-hidden="true">
            <div className="h-7 w-7 animate-pulse rounded bg-muted" />
            <div className="h-7 w-7 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}

      <span className="sr-only">Memuat data tabel...</span>
    </div>
  )
}

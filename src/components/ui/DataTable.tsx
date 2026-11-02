import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── ColumnDef ─────────────────────────────────────────────────────────────
// Minimal inline definition — tidak memerlukan @tanstack/react-table.

export interface ColumnDef<T> {
  /** Unique key identifying this column */
  key: string
  /** Column header label */
  header: string
  /** Render the cell for a given row. Defaults to `row[key]` if omitted. */
  cell?: (row: T) => React.ReactNode
  /** Optional className for the <th> / <td> */
  className?: string
}

// ─── DataTableProps ─────────────────────────────────────────────────────────

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  totalCount: number
  pageSize: number
  pageIndex: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  isLoading: boolean
  emptyMessage?: string
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

/**
 * Tabel generik dengan pagination server-side.
 *
 * - pageIndex berbasis 0 (halaman pertama = 0)
 * - Menampilkan skeleton row saat isLoading = true
 * - Menampilkan emptyMessage saat data kosong dan tidak loading
 *
 * Requirements: 6.3, 14.4
 */
export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  totalCount,
  pageSize,
  pageIndex,
  onPageChange,
  onPageSizeChange,
  isLoading,
  emptyMessage = 'Tidak ada data untuk ditampilkan.',
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = pageIndex + 1 // untuk tampilan (1-based)

  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex < totalPages - 1

  // ── info rentang ──────────────────────────────────────────────────────────
  const rangeStart = totalCount === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalCount)

  return (
    <div className="w-full space-y-3">
      {/* ── Tabel utama ── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table
          className="w-full min-w-full text-sm"
          role="table"
          aria-label="Tabel data"
          aria-busy={isLoading}
        >
          {/* Header */}
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-border bg-background">
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, rowIdx) => (
                <tr key={`skeleton-${rowIdx}`} aria-hidden="true">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="hidden" aria-hidden />
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="transition-colors hover:bg-muted/30"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-foreground', col.className)}
                    >
                      {col.cell
                        ? col.cell(row)
                        : (row[col.key] as React.ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer: info + kontrol halaman ── */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        {/* Info rentang & total */}
        <p className="text-xs text-muted-foreground">
          {totalCount === 0
            ? 'Tidak ada data'
            : `Menampilkan ${rangeStart}–${rangeEnd} dari ${totalCount} data`}
        </p>

        {/* Kanan: page-size selector + navigasi */}
        <div className="flex items-center gap-4">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="page-size-select"
              className="text-xs text-muted-foreground"
            >
              Baris per halaman:
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(0) // reset ke halaman pertama
              }}
              className={cn(
                'h-8 rounded-md border border-input bg-background px-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
              )}
              aria-label="Jumlah baris per halaman"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Tombol navigasi halaman */}
          <div className="flex items-center gap-1">
            {/* Halaman pertama */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(0)}
              disabled={!canPreviousPage || isLoading}
              aria-label="Halaman pertama"
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Halaman sebelumnya */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={!canPreviousPage || isLoading}
              aria-label="Halaman sebelumnya"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Indikator halaman */}
            <span className="min-w-[5rem] text-center text-xs text-muted-foreground">
              Hal {currentPage} / {totalPages}
            </span>

            {/* Halaman berikutnya */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={!canNextPage || isLoading}
              aria-label="Halaman berikutnya"
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Halaman terakhir */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(totalPages - 1)}
              disabled={!canNextPage || isLoading}
              aria-label="Halaman terakhir"
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

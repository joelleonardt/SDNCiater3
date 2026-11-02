import * as React from 'react'
import { Plus } from 'lucide-react'
import type { Schedule } from '@/types/database.types'
import { HARI } from './ScheduleFormModal'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface WeeklyGridProps {
  schedules: Schedule[]
  /** Dipanggil saat klik slot jadwal yang ada (untuk edit) */
  onEdit: (schedule: Schedule) => void
  /** Dipanggil saat klik "+" di kolom yang kosong atau tanpa slot */
  onAdd: (dayOfWeek: number) => void
  /** Dipanggil saat klik hapus pada slot */
  onDelete: (schedule: Schedule) => void
  canEdit: boolean
}

/**
 * Grid mingguan 6 kolom (Senin–Sabtu).
 * Setiap kolom menampilkan daftar slot jadwal hari itu.
 * Requirements: 10.1, 10.2
 */
export default function WeeklyGrid({
  schedules,
  onEdit,
  onAdd,
  onDelete,
  canEdit,
}: WeeklyGridProps) {
  // Kelompokkan jadwal per hari
  const byDay = React.useMemo(() => {
    const map: Record<number, Schedule[]> = {}
    for (const h of HARI) map[h.value] = []
    for (const s of schedules) {
      if (map[s.day_of_week]) map[s.day_of_week].push(s)
      else map[s.day_of_week] = [s]
    }
    // Urutkan per hari berdasarkan jam mulai
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return map
  }, [schedules])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {HARI.map((hari) => {
        const slots = byDay[hari.value] ?? []
        return (
          <div key={hari.value} className="flex flex-col gap-2">
            {/* Header hari */}
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{hari.label}</span>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Tambah jadwal ${hari.label}`}
                  onClick={() => onAdd(hari.value)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Slot jadwal */}
            {slots.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                Kosong
              </div>
            ) : (
              slots.map((s) => (
                <div
                  key={s.id}
                  className="group relative rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm"
                >
                  <p className="font-medium leading-snug text-foreground">{s.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </p>

                  {/* Aksi (tampil saat hover) */}
                  {canEdit && (
                    <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-md bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Edit jadwal ${s.subject}`}
                        onClick={() => onEdit(s)}
                        className="rounded bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus jadwal ${s.subject}`}
                        onClick={() => onDelete(s)}
                        className="rounded bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/80"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

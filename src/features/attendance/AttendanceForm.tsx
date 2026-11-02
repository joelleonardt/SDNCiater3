import * as React from 'react'
import { CheckSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SkeletonTable from '@/components/ui/SkeletonTable'
import EmptyState from '@/components/ui/EmptyState'
import type { AttendanceStatus } from '@/services/attendanceService'
import { useAttendance } from './useAttendance'

// ─── Tipe ────────────────────────────────────────────────────────────────────

interface AttendanceFormProps {
  classId: string
  date: string // YYYY-MM-DD
}

const STATUS_OPTIONS: AttendanceStatus[] = ['Hadir', 'Sakit', 'Izin', 'Alpa']

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Hadir: 'text-green-700 bg-green-50 border-green-200',
  Sakit: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  Izin: 'text-blue-700 bg-blue-50 border-blue-200',
  Alpa: 'text-red-700 bg-red-50 border-red-200',
}

/**
 * Form input kehadiran per siswa untuk satu kelas + tanggal.
 * Menggunakan useAttendance hook — setClassId + setDate saat mount/update.
 * Requirements: 9.4–9.6
 */
export default function AttendanceForm({ classId, date }: AttendanceFormProps) {
  const { records, loading, saving, setClassId, setDate, updateStatus, save } = useAttendance()

  // Sinkronkan props ke hook saat pertama kali dan saat berubah
  React.useEffect(() => {
    setClassId(classId)
    setDate(date)
  }, [classId, date]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    await save()
  }

  // Tandai semua hadir — update setiap record
  function markAllHadir() {
    records.forEach((r) => {
      if (r.status !== 'Hadir') updateStatus(r.student_id, 'Hadir')
    })
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return <SkeletonTable columns={2} rows={8} />

  // ── Empty state ───────────────────────────────────────────────────────────
  if (records.length === 0) {
    return (
      <EmptyState
        title="Tidak ada data kehadiran"
        description="Belum ada record kehadiran untuk kelas dan tanggal ini."
      />
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Tombol Tandai Semua Hadir */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={markAllHadir}
          disabled={saving}
          aria-label="Tandai semua siswa hadir"
        >
          <CheckSquare className="mr-2 h-4 w-4" aria-hidden="true" />
          Tandai Semua Hadir
        </Button>
      </div>

      {/* Daftar siswa */}
      <div
        role="table"
        aria-label="Daftar kehadiran siswa"
        className="overflow-hidden rounded-md border border-border"
      >
        <div
          role="row"
          className="grid grid-cols-[1fr_2fr_auto] gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground"
        >
          <span role="columnheader">ID Siswa</span>
          <span role="columnheader">Tanggal</span>
          <span role="columnheader" className="text-right">Status</span>
        </div>

        {records.map((record, idx) => (
          <div
            key={record.student_id}
            role="row"
            className={`grid grid-cols-[1fr_2fr_auto] items-center gap-4 px-4 py-3 text-sm ${
              idx < records.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <span role="cell" className="text-muted-foreground font-mono text-xs">
              {record.student_id.slice(0, 8)}…
            </span>
            <span role="cell" className="text-muted-foreground">{record.date}</span>

            <div role="cell">
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label={`Status kehadiran siswa ${record.student_id}`}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateStatus(record.student_id, opt)}
                    disabled={saving}
                    aria-pressed={record.status === opt}
                    className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                      record.status === opt
                        ? STATUS_COLORS[opt]
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tombol Simpan */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} aria-busy={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </div>
  )
}

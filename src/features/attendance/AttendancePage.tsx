import * as React from 'react'
import { CalendarDays } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/Toast/useToast'
import PageHeader from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EmptyState from '@/components/ui/EmptyState'
import { getClasses } from '@/services/classService'
import type { Class } from '@/types/database.types'
import AttendanceForm from './AttendanceForm'
import AttendanceRecap from './AttendanceRecap'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

type Tab = 'input' | 'rekap'

/**
 * Halaman Kehadiran.
 * - Selector kelas dan tanggal di atas
 * - Tab "Input Kehadiran" dan "Rekap Kehadiran"
 * Requirements: 7.1–7.9
 */
export default function AttendancePage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)
  const { toastError } = useToast()

  const [classes, setClasses] = React.useState<Class[]>([])
  const [classesLoading, setClassesLoading] = React.useState(false)

  const [selectedClassId, setSelectedClassId] = React.useState<string>('')
  const [selectedDate, setSelectedDate] = React.useState<string>(todayISO())
  const [activeTab, setActiveTab] = React.useState<Tab>('input')

  // Rekap: rentang tanggal (maks 31 hari)
  const [recapStart, setRecapStart] = React.useState<string>(todayISO())
  const [recapEnd, setRecapEnd] = React.useState<string>(todayISO())

  // ── Fetch kelas ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!profile?.school_id) return
    setClassesLoading(true)
    getClasses(profile.school_id, activeAcademicYear?.id ?? null)
      .then(setClasses)
      .catch((err: Error) => toastError('Gagal memuat daftar kelas', err.message))
      .finally(() => setClassesLoading(false))
  }, [profile?.school_id, activeAcademicYear?.id, toastError])

  // Aktifkan kelas pertama secara otomatis
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id)
    }
  }, [classes, selectedClassId])

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const formReady = !!selectedClassId && !!selectedDate

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Kehadiran" description="Catat dan lihat rekap kehadiran siswa" />

      {/* ── Filter: kelas + tanggal ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4">
        {/* Selector kelas */}
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <Label htmlFor="select-kelas">Kelas</Label>
          <select
            id="select-kelas"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={classesLoading || classes.length === 0}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            aria-label="Pilih kelas"
          >
            {classesLoading ? (
              <option>Memuat…</option>
            ) : classes.length === 0 ? (
              <option value="">Tidak ada kelas</option>
            ) : (
              <>
                <option value="" disabled>
                  Pilih kelas…
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Tanggal (hanya tampil di tab input) */}
        {activeTab === 'input' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="select-tanggal">Tanggal</Label>
            <Input
              id="select-tanggal"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
              aria-label="Pilih tanggal"
            />
          </div>
        )}

        {/* Rentang tanggal rekap */}
        {activeTab === 'rekap' && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recap-start">Dari Tanggal</Label>
              <Input
                id="recap-start"
                type="date"
                value={recapStart}
                max={recapEnd}
                onChange={(e) => setRecapStart(e.target.value)}
                className="w-40"
                aria-label="Tanggal mulai rekap"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recap-end">Sampai Tanggal</Label>
              <Input
                id="recap-end"
                type="date"
                value={recapEnd}
                min={recapStart}
                onChange={(e) => setRecapEnd(e.target.value)}
                className="w-40"
                aria-label="Tanggal akhir rekap"
              />
            </div>
          </>
        )}
      </div>

      {/* ── Tab navigation ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('input')}
          aria-pressed={activeTab === 'input'}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'input'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Input Kehadiran
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rekap')}
          aria-pressed={activeTab === 'rekap'}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeTab === 'rekap'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Rekap Kehadiran
        </button>
      </div>

      {/* ── Konten tab ──────────────────────────────────────────────────────── */}
      {!formReady ? (
        <EmptyState
          icon={CalendarDays}
          title="Pilih kelas dan tanggal"
          description="Pilih kelas terlebih dahulu untuk melihat daftar kehadiran."
        />
      ) : activeTab === 'input' ? (
        // Pasang key supaya form di-remount saat kelas/tanggal berubah (Req 7.1)
        <AttendanceForm key={`${selectedClassId}-${selectedDate}`} classId={selectedClassId} date={selectedDate} />
      ) : (
        <AttendanceRecap
          key={`${selectedClassId}-${recapStart}-${recapEnd}`}
          classId={selectedClassId}
          className={selectedClass?.name ?? ''}
          startDate={recapStart}
          endDate={recapEnd}
        />
      )}
    </div>
  )
}

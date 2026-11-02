/**
 * ReportsPage — halaman laporan kehadiran dan rapor siswa.
 * Requirements: 11.1, 11.2, 11.3
 */
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/Toast/useToast'
import PageHeader from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getClasses } from '@/services/classService'
import { supabase } from '@/services/supabase'
import { generateAttendancePdf, generateReportCardPdf } from '@/services/reportService'
import type { Class, Student, Semester } from '@/types/database.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type Tab = 'kehadiran' | 'rapor'

// ─── Shared select style ──────────────────────────────────────────────────────

const selectCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50'

// ─── Komponen ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)
  const { toastSuccess, toastError } = useToast()

  const [activeTab, setActiveTab] = React.useState<Tab>('kehadiran')

  // ── Data bersama: daftar kelas ───────────────────────────────────────────
  const [classes, setClasses] = React.useState<Class[]>([])
  const [classesLoading, setClassesLoading] = React.useState(false)

  React.useEffect(() => {
    if (!profile?.school_id) return
    setClassesLoading(true)
    getClasses(profile.school_id, activeAcademicYear?.id ?? null)
      .then(setClasses)
      .catch((err: Error) => toastError('Gagal memuat daftar kelas', err.message))
      .finally(() => setClassesLoading(false))
  }, [profile?.school_id, activeAcademicYear?.id, toastError])

  // ── Tab 1: Laporan Kehadiran ──────────────────────────────────────────────
  const [attendanceClassId, setAttendanceClassId] = React.useState('')
  const [startDate, setStartDate] = React.useState(todayISO())
  const [endDate, setEndDate] = React.useState(todayISO())
  const [attendanceLoading, setAttendanceLoading] = React.useState(false)

  async function handleAttendancePrint() {
    if (!attendanceClassId || !startDate || !endDate) return
    setAttendanceLoading(true)
    try {
      await generateAttendancePdf(attendanceClassId, startDate, endDate)
      toastSuccess('Dialog cetak dibuka', 'Gunakan dialog cetak browser untuk menyimpan PDF.')
    } catch (err) {
      toastError('Gagal membuat laporan kehadiran', (err as Error).message)
    } finally {
      setAttendanceLoading(false)
    }
  }

  // ── Tab 2: Rapor Siswa ────────────────────────────────────────────────────
  const [raporClassId, setRaporClassId] = React.useState('')
  const [students, setStudents] = React.useState<Student[]>([])
  const [studentsLoading, setStudentsLoading] = React.useState(false)
  const [selectedStudentId, setSelectedStudentId] = React.useState('')

  const [semesters, setSemesters] = React.useState<Semester[]>([])
  const [semestersLoading, setSemestersLoading] = React.useState(false)
  const [selectedSemesterId, setSelectedSemesterId] = React.useState('')

  const [raporLoading, setRaporLoading] = React.useState(false)

  // Fetch siswa saat kelas rapor berubah
  React.useEffect(() => {
    if (!raporClassId) {
      setStudents([])
      setSelectedStudentId('')
      return
    }
    setStudentsLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('class_students')
          .select('students(*)')
          .eq('class_id', raporClassId)
        if (error) throw new Error(error.message)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: Student[] = (data ?? []).map((row: any) => row.students).filter(Boolean)
        setStudents(list)
        setSelectedStudentId(list[0]?.id ?? '')
      } catch (err) {
        toastError('Gagal memuat daftar siswa', (err as Error).message)
      } finally {
        setStudentsLoading(false)
      }
    })()
  }, [raporClassId, toastError])

  // Fetch semester saat activeAcademicYear berubah
  React.useEffect(() => {
    if (!activeAcademicYear?.id) {
      setSemesters([])
      setSelectedSemesterId('')
      return
    }
    setSemestersLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('semesters')
          .select('*')
          .eq('academic_year_id', activeAcademicYear.id)
        if (error) throw new Error(error.message)
        const list = (data ?? []) as Semester[]
        setSemesters(list)
        setSelectedSemesterId(list[0]?.id ?? '')
      } catch (err) {
        toastError('Gagal memuat daftar semester', (err as Error).message)
      } finally {
        setSemestersLoading(false)
      }
    })()
  }, [activeAcademicYear?.id, toastError])

  async function handleRaporPrint() {
    if (!selectedStudentId || !selectedSemesterId) return
    setRaporLoading(true)
    try {
      await generateReportCardPdf(selectedStudentId, selectedSemesterId)
      toastSuccess('Dialog cetak dibuka', 'Gunakan dialog cetak browser untuk menyimpan PDF.')
    } catch (err) {
      toastError('Gagal membuat rapor siswa', (err as Error).message)
    } finally {
      setRaporLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Laporan" description="Cetak laporan kehadiran dan rapor siswa" />

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        {(['kehadiran', 'rapor'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'kehadiran' ? 'Laporan Kehadiran' : 'Rapor Siswa'}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Laporan Kehadiran ──────────────────────────────────────── */}
      {activeTab === 'kehadiran' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-lg">
          <h2 className="text-base font-semibold">Laporan Kehadiran</h2>

          <div className="space-y-1.5">
            <Label htmlFor="att-kelas">Kelas</Label>
            <select
              id="att-kelas"
              value={attendanceClassId}
              onChange={(e) => setAttendanceClassId(e.target.value)}
              disabled={classesLoading || classes.length === 0}
              className={selectCls}
              aria-label="Pilih kelas laporan kehadiran"
            >
              {classesLoading ? (
                <option>Memuat…</option>
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

          <div className="space-y-1.5">
            <Label htmlFor="att-start">Dari Tanggal</Label>
            <Input
              id="att-start"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="att-end">Sampai Tanggal</Label>
            <Input
              id="att-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <Button
            onClick={handleAttendancePrint}
            disabled={attendanceLoading || !attendanceClassId || !startDate || !endDate}
            className="w-full"
          >
            {attendanceLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cetak / Unduh PDF
          </Button>
        </div>
      )}

      {/* ── Tab 2: Rapor Siswa ────────────────────────────────────────────── */}
      {activeTab === 'rapor' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-lg">
          <h2 className="text-base font-semibold">Rapor Siswa</h2>

          <div className="space-y-1.5">
            <Label htmlFor="rapor-kelas">Kelas</Label>
            <select
              id="rapor-kelas"
              value={raporClassId}
              onChange={(e) => setRaporClassId(e.target.value)}
              disabled={classesLoading || classes.length === 0}
              className={selectCls}
              aria-label="Pilih kelas rapor"
            >
              {classesLoading ? (
                <option>Memuat…</option>
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

          <div className="space-y-1.5">
            <Label htmlFor="rapor-siswa">Siswa</Label>
            <select
              id="rapor-siswa"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={studentsLoading || students.length === 0 || !raporClassId}
              className={selectCls}
              aria-label="Pilih siswa rapor"
            >
              {studentsLoading ? (
                <option>Memuat…</option>
              ) : (
                <>
                  <option value="" disabled>
                    {raporClassId ? 'Pilih siswa…' : 'Pilih kelas dulu'}
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rapor-semester">Semester</Label>
            <select
              id="rapor-semester"
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              disabled={semestersLoading || semesters.length === 0}
              className={selectCls}
              aria-label="Pilih semester rapor"
            >
              {semestersLoading ? (
                <option>Memuat…</option>
              ) : (
                <>
                  <option value="" disabled>
                    Pilih semester…
                  </option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <Button
            onClick={handleRaporPrint}
            disabled={raporLoading || !selectedStudentId || !selectedSemesterId}
            className="w-full"
          >
            {raporLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cetak / Unduh PDF
          </Button>
        </div>
      )}
    </div>
  )
}

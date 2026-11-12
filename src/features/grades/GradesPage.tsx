import * as React from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/Toast/useToast'
import { getClasses } from '@/services/classService'
import { getSemestersByAcademicYear, getGradeScales } from '@/services/settingsService'
import { useGrades } from './useGrades'
import PageHeader from '@/components/ui/PageHeader'
import { Label } from '@/components/ui/label'
import GradeComponentsConfig from './GradeComponentsConfig'
import GradeInputTable from './GradeInputTable'
import type { Class, Semester, GradeScale } from '@/types/database.types'

/**
 * Halaman pengelolaan nilai: pilih kelas + semester,
 * lalu konfigurasi komponen nilai dan input nilai siswa.
 * Requirements: 10.1–10.9
 */
export default function GradesPage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)
  const { toastError } = useToast()

  // ── Pilihan kelas & semester ───────────────────────────────────────────────
  const [classes, setClasses] = React.useState<Class[]>([])
  const [semesters, setSemesters] = React.useState<Semester[]>([])
  const [gradeScales, setGradeScales] = React.useState<GradeScale[]>([])
  const [classId, setClassId] = React.useState('')
  const [semesterId, setSemesterId] = React.useState('')

  // Muat kelas & skala nilai saat sekolah / tahun ajaran aktif berubah
  React.useEffect(() => {
    if (!profile?.school_id) return
    getGradeScales(profile.school_id)
      .then(setGradeScales)
      .catch(() => {})
  }, [profile?.school_id])

  React.useEffect(() => {
    if (!profile?.school_id || !activeAcademicYear?.id) {
      setClasses([])
      return
    }
    getClasses(profile.school_id, activeAcademicYear.id)
      .then(setClasses)
      .catch(() => toastError('Gagal memuat daftar kelas'))
  }, [profile?.school_id, activeAcademicYear?.id, toastError])

  // Muat semester saat tahun ajaran aktif berubah
  React.useEffect(() => {
    if (!activeAcademicYear?.id) {
      setSemesters([])
      setSemesterId('')
      return
    }
    getSemestersByAcademicYear(activeAcademicYear.id)
      .then((list) => {
        setSemesters(list)
        if (list.length > 0 && !semesterId) setSemesterId(list[0].id)
      })
      .catch(() => toastError('Gagal memuat daftar semester'))
  }, [activeAcademicYear?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data nilai ────────────────────────────────────────────────────────────
  const { components, gradeRows, loading, saving, saveComponents, updateScore, saveAllGrades } =
    useGrades(classId, semesterId)

  // Hanya Staf_Admin yang dapat mengonfigurasi komponen nilai (Req 10.1)
  const canEditComponents = profile?.role === 'Staf_Admin'
  // Guru dan Staf_Admin dapat menginput nilai siswa (Req 10.4)
  const canInputGrades = profile?.role === 'Guru' || profile?.role === 'Staf_Admin'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Nilai"
        description={
          activeAcademicYear
            ? `Tahun ajaran: ${activeAcademicYear.name}`
            : 'Pilih tahun ajaran aktif di pengaturan'
        }
      />

      {/* Filter kelas + semester */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <Label htmlFor="select-kelas">Kelas</Label>
          <select
            id="select-kelas"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            aria-label="Pilih kelas"
          >
            <option value="">— Pilih Kelas —</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <Label htmlFor="select-semester">Semester</Label>
          <select
            id="select-semester"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            aria-label="Pilih semester"
          >
            <option value="">— Pilih Semester —</option>
            {semesters.map((sem) => (
              <option key={sem.id} value={sem.id}>
                Semester {sem.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Konten hanya tampil setelah kelas + semester dipilih */}
      {classId && semesterId ? (
        <div className="space-y-6">
          {/* 1. Konfigurasi komponen nilai */}
          <GradeComponentsConfig
            classId={classId}
            semesterId={semesterId}
            components={components}
            saving={saving}
            readOnly={!canEditComponents}
            onSave={saveComponents}
          />

          {/* 2. Tabel input nilai */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Input Nilai Siswa</h2>
            <GradeInputTable
              components={components}
              gradeRows={gradeRows}
              gradeScales={gradeScales}
              loading={loading}
              saving={saving}
              readOnly={!canInputGrades}
              onUpdateScore={updateScore}
              onSave={saveAllGrades}
            />
          </section>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pilih kelas dan semester untuk mulai mengelola nilai.
        </p>
      )}
    </div>
  )
}

import * as React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/Toast/useToast'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import {
  getStudentById,
  getStudentClasses,
  getStudentAttendanceSummary,
  updateStudent,
  type StudentAttendanceSummary,
} from '@/services/studentService'
import { getClasses } from '@/services/classService'
import type { Student, Class } from '@/types/database.types'
import StudentFormModal, { type StudentFormValues } from './StudentFormModal'
import NoteList from '@/features/notes/NoteList'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-3">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm text-foreground">{value || '—'}</dd>
    </div>
  )
}

// ─── Komponen utama ───────────────────────────────────────────────────────────

/**
 * Halaman detail siswa.
 * Menampilkan data lengkap siswa, kelas yang diikuti, ringkasan kehadiran,
 * dan daftar catatan perilaku/prestasi (NoteList).
 * Tombol Edit membuka StudentFormModal.
 *
 * Requirements: 6.5, 6.6, 9.2
 */
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toastSuccess, toastError } = useToast()
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)

  const [student, setStudent] = React.useState<Student | null>(null)
  const [classes, setClasses] = React.useState<Class[]>([])
  const [allClasses, setAllClasses] = React.useState<Class[]>([])
  const [attendanceSummary, setAttendanceSummary] = React.useState<StudentAttendanceSummary>({
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(searchParams.get('edit') === '1')

  // ── Muat data siswa ──
  React.useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const [s, c, att] = await Promise.all([
          getStudentById(id!),
          getStudentClasses(id!),
          getStudentAttendanceSummary(id!),
        ])
        if (cancelled) return
        setStudent(s)
        setClasses(c)
        setAttendanceSummary(att)
      } catch {
        if (cancelled) return
        setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  React.useEffect(() => {
    if (!profile?.school_id) return
    getClasses(profile.school_id, activeAcademicYear?.id ?? null)
      .then((list) => setAllClasses(list))
      .catch(() => {})
  }, [profile?.school_id, activeAcademicYear?.id])

  // ── Handler edit ──
  async function handleEdit(values: StudentFormValues) {
    if (!student) return
    try {
      const updated = await updateStudent(
        student.id,
        {
          full_name: values.full_name,
          nis: values.nis,
          gender: values.gender,
          date_of_birth: values.date_of_birth,
          parent_name: values.parent_name || null,
          parent_contact: values.parent_contact || null,
        },
        values.class_id || null,
        activeAcademicYear?.id ?? null
      )
      const updatedClasses = await getStudentClasses(student.id)
      setStudent(updated)
      setClasses(updatedClasses)
      setEditOpen(false)
      if (searchParams.has('edit')) {
        searchParams.delete('edit')
        setSearchParams(searchParams, { replace: true })
      }
      toastSuccess('Data siswa berhasil diperbarui')
    } catch (err) {
      toastError(
        'Gagal memperbarui data siswa',
        err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.'
      )
      throw err
    }
  }

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-muted-foreground">Memuat data siswa…</span>
      </div>
    )
  }

  // ── Render: tidak ditemukan ──
  if (notFound || !student) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-lg font-medium text-foreground">Siswa tidak ditemukan</p>
        <Button variant="outline" onClick={() => navigate('/students')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke daftar siswa
        </Button>
      </div>
    )
  }

  // Hanya Staf_Admin yang dapat mengedit data pokok siswa (Req 1.4 & 6.6)
  const canEdit = profile?.role === 'Staf_Admin'

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={student.full_name}
        description={`NIS: ${student.nis}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/students')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Data diri */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Data Diri</h2>
            </div>
            <dl className="divide-y divide-border px-6">
              <DetailRow label="Nama Lengkap" value={student.full_name} />
              <DetailRow label="NIS" value={student.nis} />
              <DetailRow label="Jenis Kelamin" value={student.gender} />
              <DetailRow label="Tanggal Lahir" value={formatDate(student.date_of_birth)} />
              <DetailRow label="Nama Orang Tua" value={student.parent_name} />
              <DetailRow label="Kontak Orang Tua" value={student.parent_contact} />
            </dl>
          </div>

          {/* Catatan Perilaku & Prestasi (Req 6.5, 9.2) */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Catatan Perilaku & Prestasi</h2>
            </div>
            <div className="p-6">
              <NoteList studentId={student.id} />
            </div>
          </div>
        </div>

        {/* Kolom kanan: Kelas + Ringkasan Kehadiran */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Kelas</h2>
            </div>
            <div className="px-6 py-4">
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Siswa belum terdaftar di kelas manapun.
                </p>
              ) : (
                <ul className="space-y-2">
                  {classes.map((cls) => (
                    <li
                      key={cls.id}
                      className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                    >
                      {cls.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Ringkasan Kehadiran (Req 6.5) */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Ringkasan Kehadiran</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-6">
              <div className="rounded-md bg-green-50 p-3 text-center">
                <p className="text-xs font-medium text-green-700">Hadir</p>
                <p className="text-xl font-bold text-green-800">{attendanceSummary.hadir}</p>
              </div>
              <div className="rounded-md bg-yellow-50 p-3 text-center">
                <p className="text-xs font-medium text-yellow-700">Sakit</p>
                <p className="text-xl font-bold text-yellow-800">{attendanceSummary.sakit}</p>
              </div>
              <div className="rounded-md bg-blue-50 p-3 text-center">
                <p className="text-xs font-medium text-blue-700">Izin</p>
                <p className="text-xl font-bold text-blue-800">{attendanceSummary.izin}</p>
              </div>
              <div className="rounded-md bg-red-50 p-3 text-center">
                <p className="text-xs font-medium text-red-700">Alfa</p>
                <p className="text-xl font-bold text-red-800">{attendanceSummary.alfa}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal edit */}
      <StudentFormModal
        open={editOpen}
        student={{ ...student, class_id: classes[0]?.id ?? null }}
        classes={allClasses}
        onSubmit={handleEdit}
        onClose={() => {
          setEditOpen(false)
          if (searchParams.has('edit')) {
            searchParams.delete('edit')
            setSearchParams(searchParams, { replace: true })
          }
        }}
      />
    </div>
  )
}

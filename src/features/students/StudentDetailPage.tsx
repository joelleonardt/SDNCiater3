import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/Toast/useToast'
import { useAuthStore } from '@/stores/authStore'
import { getStudentById, updateStudent } from '@/services/studentService'
import { supabase } from '@/services/supabase'
import type { Student, Class } from '@/types/database.types'
import StudentFormModal, { type StudentFormValues } from './StudentFormModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  // Tampilkan tanggal dalam format DD/MM/YYYY (lokal Indonesia)
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

// ─── Ambil kelas siswa ────────────────────────────────────────────────────────

async function getStudentClasses(studentId: string): Promise<Class[]> {
  const { data, error } = await supabase
    .from('class_students')
    .select('class_id, classes(*)')
    .eq('student_id', studentId)

  if (error) throw new Error(error.message)

  // Supabase returns the joined row as classes: Class
  return (data ?? [])
    .map((row) => (row as { class_id: string; classes: Class | null }).classes)
    .filter((c): c is Class => c !== null)
}

// ─── Komponen utama ───────────────────────────────────────────────────────────

/**
 * Halaman detail siswa.
 * Menampilkan data lengkap siswa beserta daftar kelas yang diikuti.
 * Tombol Edit membuka StudentFormModal.
 *
 * Requirements: 8.3, 8.5, 8.6
 */
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toastSuccess, toastError } = useToast()
  const profile = useAuthStore((s) => s.profile)

  const [student, setStudent] = React.useState<Student | null>(null)
  const [classes, setClasses] = React.useState<Class[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

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
        const [s, c] = await Promise.all([
          getStudentById(id!),
          getStudentClasses(id!),
        ])
        if (cancelled) return
        setStudent(s)
        setClasses(c)
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

  // ── Handler edit ──
  async function handleEdit(values: StudentFormValues) {
    if (!student) return
    try {
      const updated = await updateStudent(student.id, {
        full_name: values.full_name,
        nis: values.nis,
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        parent_name: values.parent_name || null,
        parent_contact: values.parent_contact || null,
      })
      setStudent(updated)
      setEditOpen(false)
      toastSuccess('Data siswa berhasil diperbarui')
    } catch (err) {
      toastError(
        'Gagal memperbarui data siswa',
        err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.'
      )
      // Re-throw agar modal tetap terbuka (isSubmitting reset)
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

  const canEdit = profile?.role === 'Guru' || profile?.role === 'Staf_Admin'

  return (
    <>
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
        <div className="lg:col-span-2">
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
        </div>

        {/* Kelas yang diikuti */}
        <div>
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
        </div>
      </div>

      {/* Modal edit */}
      <StudentFormModal
        open={editOpen}
        student={student}
        onSubmit={handleEdit}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}

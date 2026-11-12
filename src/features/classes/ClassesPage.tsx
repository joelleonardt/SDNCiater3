import * as React from 'react'
import { Plus, Search, GraduationCap } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/Toast/useToast'
import PageHeader from '@/components/ui/PageHeader'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ClassFormModal from './ClassFormModal'
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  type ClassWithDetails,
} from '@/services/classService'
import { getTeachers } from '@/services/scheduleService'
import type { Profile } from '@/types/database.types'

// ─── Tipe lokal ──────────────────────────────────────────────────────────────

type ClassRow = ClassWithDetails

type FormValues = {
  name: string
  grade_level: number
  homeroom_teacher_id?: string
}

const PAGE_SIZE = 10

/**
 * Halaman daftar kelas.
 * - Guru dan Staf_Admin dapat menambah/edit/hapus kelas.
 * - Kepala_Sekolah hanya dapat melihat.
 * Requirements: 5.1–5.6
 */
export default function ClassesPage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)
  const { toastSuccess, toastError } = useToast()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = React.useState<ClassRow[]>([])
  const [teachers, setTeachers] = React.useState<Profile[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  // ── Search + pagination ───────────────────────────────────────────────────
  const [search, setSearch] = React.useState('')
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE)

  // ── Modal tambah/edit ─────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<ClassRow | undefined>()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ── Konfirmasi hapus ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<ClassRow | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Peran yang boleh CUD (Hanya Staf_Admin, Req 1.4 & 5.2-5.5)
  const canEdit = profile?.role === 'Staf_Admin'

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchClasses = React.useCallback(async () => {
    if (!profile?.school_id) return
    setIsLoading(true)
    try {
      const [data, teacherList] = await Promise.all([
        getClasses(profile.school_id, activeAcademicYear?.id ?? null),
        getTeachers(profile.school_id),
      ])
      setRows(data)
      setTeachers(teacherList)
      setPageIndex(0) // reset ke halaman pertama setelah fetch
    } catch (err) {
      toastError('Gagal memuat data kelas', (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [profile?.school_id, activeAcademicYear?.id, toastError])

  React.useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  // ── Filter lokal berdasarkan search ──────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        String(r.grade_level).includes(q) ||
        (r.homeroom_teacher_name ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  // ── Pagination ────────────────────────────────────────────────────────────
  const paginated = React.useMemo(
    () => filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filtered, pageIndex, pageSize],
  )

  // ── Kolom tabel ───────────────────────────────────────────────────────────
  const columns: ColumnDef<ClassRow>[] = React.useMemo(
    () => [
      {
        key: 'name',
        header: 'Nama Kelas',
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: 'grade_level',
        header: 'Tingkat',
        cell: (row) => `Tingkat ${row.grade_level}`,
        className: 'w-28',
      },
      {
        key: 'homeroom_teacher_name',
        header: 'Wali Kelas',
        cell: (row) => row.homeroom_teacher_name ?? '—',
      },
      {
        key: 'student_count',
        header: 'Jumlah Siswa',
        cell: (row) => `${row.student_count ?? 0} siswa`,
        className: 'w-32',
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: 'Aksi',
              className: 'w-28 text-right',
              cell: (row: ClassRow) => (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditTarget(row)
                      setFormError(null)
                      setModalOpen(true)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(row)}
                  >
                    Hapus
                  </Button>
                </div>
              ),
            } satisfies ColumnDef<ClassRow>,
          ]
        : []),
    ],
    [canEdit],
  )

  // ── Submit form tambah/edit ───────────────────────────────────────────────
  async function handleFormSubmit(values: FormValues) {
    if (!profile?.school_id || !activeAcademicYear?.id) return
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (editTarget) {
        await updateClass(editTarget.id, {
          name: values.name,
          grade_level: values.grade_level,
          homeroom_teacher_id: values.homeroom_teacher_id || null,
        })
        toastSuccess('Kelas berhasil diperbarui')
      } else {
        await createClass({
          school_id: profile.school_id,
          academic_year_id: activeAcademicYear.id,
          name: values.name,
          grade_level: values.grade_level,
          homeroom_teacher_id: values.homeroom_teacher_id || null,
        })
        toastSuccess('Kelas berhasil ditambahkan')
      }
      setModalOpen(false)
      setEditTarget(undefined)
      await fetchClasses()
    } catch (err) {
      const msg = (err as Error).message
      setFormError(msg)
      toastError('Gagal menyimpan kelas', msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Hapus ─────────────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteClass(deleteTarget.id)
      toastSuccess('Kelas berhasil dihapus')
      setDeleteTarget(null)
      await fetchClasses()
    } catch (err) {
      toastError('Gagal menghapus kelas', (err as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Kelas"
        description={
          activeAcademicYear
            ? `Tahun ajaran: ${activeAcademicYear.name}`
            : 'Pilih tahun ajaran aktif untuk melihat daftar kelas'
        }
        actions={
          canEdit ? (
            <Button
              onClick={() => {
                setEditTarget(undefined)
                setModalOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Kelas
            </Button>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder="Cari nama kelas atau tingkat…"
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPageIndex(0)
          }}
          aria-label="Cari kelas"
        />
      </div>

      {/* Tabel atau empty state */}
      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={search ? 'Kelas tidak ditemukan' : 'Belum ada kelas'}
          description={
            search
              ? 'Coba ubah kata kunci pencarian Anda.'
              : canEdit
              ? 'Klik tombol "Tambah Kelas" untuk menambahkan kelas pertama.'
              : 'Belum ada data kelas untuk tahun ajaran ini.'
          }
          action={
            canEdit && !search ? (
              <Button
                onClick={() => {
                  setEditTarget(undefined)
                  setModalOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Tambah Kelas
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={paginated}
          totalCount={filtered.length}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(0)
          }}
          isLoading={isLoading}
          emptyMessage="Tidak ada kelas yang sesuai."
        />
      )}

      {/* Modal tambah/edit */}
      {modalOpen && (
        <ClassFormModal
          initialData={editTarget}
          teachers={teachers}
          serverError={formError}
          isSubmitting={isSubmitting}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setModalOpen(false)
            setEditTarget(undefined)
            setFormError(null)
          }}
        />
      )}

      {/* Dialog konfirmasi hapus */}
      <ConfirmDialog
        open={!!deleteTarget}
        recordName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </div>
  )
}

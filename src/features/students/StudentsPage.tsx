import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, Search, FileSpreadsheet } from 'lucide-react'

import PageHeader from '@/components/ui/PageHeader'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/Toast/useToast'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { formatDate } from '@/lib/utils'
import { createStudent, type StudentWithClass } from '@/services/studentService'
import { getClasses } from '@/services/classService'
import type { Class } from '@/types/database.types'

import { useStudents } from './useStudents'
import StudentFormModal, { type StudentFormValues } from './StudentFormModal'
import CsvImportDialog from './CsvImportDialog'

// ─── Opsi filter gender ───────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'Laki-laki', label: 'Laki-laki' },
  { value: 'Perempuan', label: 'Perempuan' },
]

// ─── StudentsPage ─────────────────────────────────────────────────────────────

/**
 * Halaman daftar siswa dengan search (debounce 300ms), filter gender, dan pagination.
 * Requirements: 6.1–6.10
 */
export default function StudentsPage() {
  const navigate = useNavigate()
  const { toastSuccess, toastError } = useToast()
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)

  const {
    data,
    totalCount,
    isLoading,
    error,
    pageIndex,
    pageSize,
    setSearch,
    setGender,
    setPageIndex,
    setPageSize,
    deleteStudent,
    refresh,
  } = useStudents()

  // state untuk soft-delete dialog
  const [deleteTarget, setDeleteTarget] = React.useState<StudentWithClass | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // state untuk tambah siswa & impor CSV
  const [createOpen, setCreateOpen] = React.useState(false)
  const [csvDialogOpen, setCsvDialogOpen] = React.useState(false)
  const [classes, setClasses] = React.useState<Class[]>([])

  // nilai input search (controlled) — debounce ditangani di hook
  const [searchInput, setSearchInput] = React.useState('')

  // Hanya Staf_Admin yang dapat menambah, mengedit, atau menghapus master data siswa (Req 1.4 & 6.4, 6.7)
  const canModify = profile?.role === 'Staf_Admin'

  React.useEffect(() => {
    if (!profile?.school_id) return
    getClasses(profile.school_id, activeAcademicYear?.id ?? null)
      .then((list) => setClasses(list))
      .catch(() => {})
  }, [profile?.school_id, activeAcademicYear?.id])

  // ── kolom tabel ──────────────────────────────────────────────────────────

  const columns: ColumnDef<StudentWithClass>[] = React.useMemo(
    () => [
      {
        key: 'nis',
        header: 'NIS',
        className: 'w-32',
      },
      {
        key: 'full_name',
        header: 'Nama Lengkap',
        cell: (row) => (
          <button
            type="button"
            className="text-left font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => navigate(`/students/${row.id}`)}
            aria-label={`Lihat detail ${row.full_name}`}
          >
            {row.full_name}
          </button>
        ),
      },
      {
        key: 'gender',
        header: 'Jenis Kelamin',
        className: 'w-36',
      },
      {
        key: 'class_name',
        header: 'Kelas',
        className: 'w-32',
        cell: (row) => row.class_name ?? '—',
      },
      {
        key: 'date_of_birth',
        header: 'Tanggal Lahir',
        className: 'w-44',
        cell: (row) => (row.date_of_birth ? formatDate(row.date_of_birth) : '—'),
      },
      {
        key: 'actions',
        header: 'Aksi',
        className: 'w-36',
        cell: (row) => (
          <div className="flex items-center gap-1">
            {/* Tombol detail */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/students/${row.id}`)}
              aria-label={`Detail ${row.full_name}`}
              className="h-8 w-8"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canModify && (
              <>
                {/* Tombol edit — navigasi ke StudentDetailPage dengan mode edit */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/students/${row.id}?edit=1`)}
                  aria-label={`Edit ${row.full_name}`}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {/* Tombol hapus */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(row)}
                  aria-label={`Hapus ${row.full_name}`}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [navigate, canModify],
  )

  // ── tambah siswa baru ─────────────────────────────────────────────────────

  async function handleCreateStudent(values: StudentFormValues) {
    if (!profile?.school_id) return
    try {
      await createStudent(
        {
          school_id: profile.school_id,
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
      setCreateOpen(false)
      toastSuccess('Siswa berhasil ditambahkan')
      refresh()
    } catch (err) {
      toastError(
        'Gagal menambahkan siswa',
        err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.'
      )
      throw err
    }
  }

  // ── konfirmasi hapus ──────────────────────────────────────────────────────

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteStudent(deleteTarget.id)
      toastSuccess(
        'Siswa berhasil dihapus',
        `${deleteTarget.full_name} telah dihapus dari sistem.`,
      )
      setDeleteTarget(null)
    } catch {
      toastError('Gagal menghapus siswa', 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Siswa"
        description="Kelola data peserta didik sekolah"
        actions={
          canModify ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCsvDialogOpen(true)}
                aria-label="Impor CSV siswa"
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Impor CSV
              </Button>
              <Button
                onClick={() => setCreateOpen(true)}
                aria-label="Tambah siswa baru"
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Tambah Siswa
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* ── Baris filter & search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setSearch(e.target.value)
            }}
            placeholder="Cari nama atau NIS…"
            aria-label="Cari siswa berdasarkan nama atau NIS"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filter gender */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="gender-filter"
            className="shrink-0 text-sm text-muted-foreground"
          >
            Jenis Kelamin:
          </label>
          <select
            id="gender-filter"
            defaultValue=""
            onChange={(e) => setGender(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter berdasarkan jenis kelamin"
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabel siswa ── */}
      <DataTable
        columns={columns}
        data={data}
        totalCount={totalCount}
        pageSize={pageSize}
        pageIndex={pageIndex}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        emptyMessage="Tidak ada siswa yang ditemukan."
      />

      {/* ── Dialog tambah siswa ── */}
      <StudentFormModal
        open={createOpen}
        classes={classes}
        onSubmit={handleCreateStudent}
        onClose={() => setCreateOpen(false)}
      />

      {/* ── Dialog Impor CSV (placeholder) ── */}
      <CsvImportDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
      />

      {/* ── Dialog konfirmasi hapus ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        recordName={deleteTarget?.full_name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </div>
  )
}

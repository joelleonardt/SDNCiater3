import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, Search } from 'lucide-react'

import PageHeader from '@/components/ui/PageHeader'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/Toast/useToast'
import { formatDate } from '@/lib/utils'
import type { Student } from '@/types/database.types'

import { useStudents } from './useStudents'

// ─── Opsi filter gender ───────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'Laki-laki', label: 'Laki-laki' },
  { value: 'Perempuan', label: 'Perempuan' },
]

// ─── StudentsPage ─────────────────────────────────────────────────────────────

/**
 * Halaman daftar siswa dengan search (debounce 300ms), filter gender, dan pagination.
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */
export default function StudentsPage() {
  const navigate = useNavigate()
  const { toastSuccess, toastError } = useToast()

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
  } = useStudents()

  // state untuk soft-delete dialog
  const [deleteTarget, setDeleteTarget] = React.useState<Student | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // nilai input search (controlled) — debounce ditangani di hook
  const [searchInput, setSearchInput] = React.useState('')

  // ── kolom tabel ──────────────────────────────────────────────────────────

  const columns: ColumnDef<Student>[] = React.useMemo(
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
          </div>
        ),
      },
    ],
    [navigate],
  )

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
          <Button
            onClick={() => navigate('/students/new')}
            aria-label="Tambah siswa baru"
          >
            <Plus className="h-4 w-4" />
            Tambah Siswa
          </Button>
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

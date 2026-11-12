import * as React from 'react'
import { Users, Plus, Search } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/components/ui/PageHeader'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUsers } from './useUsers'
import UserFormModal from './UserFormModal'
import type { Profile } from '@/types/database.types'

type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_FILTER_OPTIONS: { value: Role | 'Semua'; label: string }[] = [
  { value: 'Semua', label: 'Semua' },
  { value: 'Guru', label: 'Guru' },
  { value: 'Kepala_Sekolah', label: 'Kepala Sekolah' },
  { value: 'Staf_Admin', label: 'Staf Admin' },
]

const roleBadge: Record<Role, string> = {
  Guru: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Kepala_Sekolah: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  Staf_Admin: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

const roleLabel: Record<Role, string> = {
  Guru: 'Guru',
  Kepala_Sekolah: 'Kepala Sekolah',
  Staf_Admin: 'Staf Admin',
}

const PAGE_SIZE = 10

/**
 * Halaman manajemen pengguna.
 * - Staf_Admin: dapat menambah akun pengguna via UI, mengedit peran, dan toggle aktif/nonaktif (Req 12.3–12.8).
 * - Kepala_Sekolah: hanya melihat data pengguna secara read-only (Req 12.9).
 * - Menampilkan nama lengkap, email, peran, status, dan tanggal dibuat (Req 12.2).
 */
export default function UsersPage() {
  const profile = useAuthStore((s) => s.profile)
  const canManageUsers = profile?.role === 'Staf_Admin'
  const { users, loading, addUser, updateRole, toggleActive } = useUsers()

  // ── Filter & pagination ───────────────────────────────────────────────────
  const [roleFilter, setRoleFilter] = React.useState<Role | 'Semua'>('Semua')
  const [search, setSearch] = React.useState('')
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE)

  // ── Modal tambah & edit ───────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Profile | null>(null)

  // ── Konfirmasi toggle aktif ───────────────────────────────────────────────
  const [toggleTarget, setToggleTarget] = React.useState<Profile | null>(null)
  const [isToggling, setIsToggling] = React.useState(false)

  // ── Filter lokal ──────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let result = users
    if (roleFilter !== 'Semua') {
      result = result.filter((u) => u.role === roleFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [users, roleFilter, search])

  // Reset ke halaman 1 saat filter berubah
  React.useEffect(() => { setPageIndex(0) }, [roleFilter, search])

  // ── Pagination ────────────────────────────────────────────────────────────
  const paginated = React.useMemo(
    () => filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filtered, pageIndex, pageSize],
  )

  // ── Kolom tabel ───────────────────────────────────────────────────────────
  const columns: ColumnDef<Profile>[] = React.useMemo(
    () => [
      {
        key: 'full_name',
        header: 'Nama',
        cell: (row) => <span className="font-medium">{row.full_name}</span>,
      },
      {
        key: 'email',
        header: 'Email',
        cell: (row) => (
          <span className="text-muted-foreground text-sm">
            {row.email || '—'}
          </span>
        ),
      },
      {
        key: 'role',
        header: 'Peran',
        cell: (row) => (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              roleBadge[row.role],
            )}
          >
            {roleLabel[row.role]}
          </span>
        ),
        className: 'w-36',
      },
      {
        key: 'is_active',
        header: 'Status',
        className: 'w-28',
        cell: (row) =>
          canManageUsers ? (
            <button
              type="button"
              onClick={() => setToggleTarget(row)}
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                'cursor-pointer transition-opacity hover:opacity-80',
                row.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
              aria-label={row.is_active ? 'Nonaktifkan pengguna' : 'Aktifkan pengguna'}
            >
              {row.is_active ? 'Aktif' : 'Nonaktif'}
            </button>
          ) : (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                row.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              {row.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          ),
      },
      {
        key: 'created_at',
        header: 'Tanggal Dibuat',
        className: 'w-36',
        cell: (row) => (row.created_at ? formatDate(row.created_at) : '—'),
      },
      ...(canManageUsers
        ? [
            {
              key: 'actions',
              header: 'Aksi',
              className: 'w-20 text-right',
              cell: (row: Profile) => (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTarget(row)}
                  >
                    Edit
                  </Button>
                </div>
              ),
            } satisfies ColumnDef<Profile>,
          ]
        : []),
    ],
    [canManageUsers],
  )

  // ── Toggle aktif ──────────────────────────────────────────────────────────
  async function handleToggleConfirm() {
    if (!toggleTarget) return
    setIsToggling(true)
    try {
      await toggleActive(toggleTarget.id, !toggleTarget.is_active)
    } finally {
      setIsToggling(false)
      setToggleTarget(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pengguna"
        description="Kelola akun pengguna dan penetapan peran sistem."
        actions={
          canManageUsers && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Pengguna
            </Button>
          )
        }
      />

      {/* Filter peran & pencarian */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter peran">
          {ROLE_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={roleFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Tabel atau empty state */}
      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tidak ada pengguna"
          description={
            search
              ? 'Tidak ditemukan pengguna yang sesuai dengan pencarian.'
              : roleFilter !== 'Semua'
                ? `Tidak ada pengguna dengan peran ${roleLabel[roleFilter as Role]}.`
                : 'Belum ada pengguna terdaftar.'
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
          onPageSizeChange={(size) => { setPageSize(size); setPageIndex(0) }}
          isLoading={loading}
          emptyMessage="Tidak ada pengguna yang sesuai."
        />
      )}

      {/* Modal tambah pengguna */}
      {createOpen && (
        <UserFormModal
          onClose={() => setCreateOpen(false)}
          onCreate={addUser}
        />
      )}

      {/* Modal edit peran */}
      {editTarget && (
        <UserFormModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={updateRole}
        />
      )}

      {/* Dialog konfirmasi toggle aktif */}
      <ConfirmDialog
        open={!!toggleTarget}
        message={
          toggleTarget
            ? toggleTarget.is_active
              ? `Nonaktifkan pengguna "${toggleTarget.full_name}"?`
              : `Aktifkan kembali pengguna "${toggleTarget.full_name}"?`
            : undefined
        }
        confirmLabel={toggleTarget?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleTarget(null)}
        isLoading={isToggling}
      />
    </div>
  )
}

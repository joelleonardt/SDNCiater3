import * as React from 'react'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
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
 * - Filter peran client-side
 * - Toggle aktif/nonaktif dengan konfirmasi
 * - Edit peran via UserFormModal
 * Requirements: 12.1–12.5
 */
export default function UsersPage() {
  const { users, loading, updateRole, toggleActive } = useUsers()

  // ── Filter & pagination ───────────────────────────────────────────────────
  const [roleFilter, setRoleFilter] = React.useState<Role | 'Semua'>('Semua')
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE)

  // ── Modal edit ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = React.useState<Profile | null>(null)

  // ── Konfirmasi toggle aktif ───────────────────────────────────────────────
  const [toggleTarget, setToggleTarget] = React.useState<Profile | null>(null)
  const [isToggling, setIsToggling] = React.useState(false)

  // ── Filter lokal ──────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    if (roleFilter === 'Semua') return users
    return users.filter((u) => u.role === roleFilter)
  }, [users, roleFilter])

  // Reset ke halaman 1 saat filter berubah
  React.useEffect(() => { setPageIndex(0) }, [roleFilter])

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
        className: 'w-40',
      },
      {
        key: 'is_active',
        header: 'Status',
        className: 'w-32',
        cell: (row) => (
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
        ),
      },
      {
        key: 'actions',
        header: 'Aksi',
        className: 'w-20 text-right',
        cell: (row) => (
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
      },
    ],
    [],
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
        description="Untuk menambahkan pengguna baru, gunakan Supabase Dashboard"
      />

      {/* Filter peran */}
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

      {/* Tabel atau empty state */}
      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tidak ada pengguna"
          description={
            roleFilter !== 'Semua'
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

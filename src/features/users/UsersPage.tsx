import * as React from 'react'
import { Users, Plus, Search, Clock, RefreshCw } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { isUserPendingVerification } from '@/services/userService'
import PageHeader from '@/components/ui/PageHeader'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUsers } from './useUsers'
import UserFormModal from './UserFormModal'
import PendingVerificationList from './PendingVerificationList'
import type { Profile } from '@/types/database.types'

type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'
type RoleFilter = Role | 'Semua' | 'pending'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'Semua', label: 'Semua' },
  { value: 'pending', label: 'Menunggu Verifikasi' },
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
  const {
    users,
    loading,
    error,
    reload,
    addUser,
    updateRole,
    verifyUser,
    rejectVerification,
    toggleActive,
  } = useUsers()

  const pendingVerificationUsers = React.useMemo(
    () => users.filter(isUserPendingVerification),
    [users]
  )

  // ── Filter & pagination ───────────────────────────────────────────────────
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('Semua')
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
    if (roleFilter === 'pending') {
      result = result.filter(isUserPendingVerification)
    } else if (roleFilter !== 'Semua') {
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
          <div className="flex flex-col items-start gap-1">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                roleBadge[row.role],
              )}
            >
              {roleLabel[row.role]}
            </span>
            {!row.school_id && row.is_active !== false && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Akun Baru
              </span>
            )}
            {row.requested_role && (!row.school_id || row.requested_role !== row.role) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Ajuan: {roleLabel[row.requested_role]}
              </span>
            )}
          </div>
        ),
        className: 'w-44',
      },
      {
        key: 'is_active',
        header: 'Status',
        className: 'w-36',
        cell: (row) =>
          !row.school_id && row.is_active !== false ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Menunggu Verifikasi
            </span>
          ) : canManageUsers ? (
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
              className: 'w-28 text-right',
              cell: (row: Profile) => (
                <div className="flex justify-end">
                  <Button
                    variant={!row.school_id && row.is_active !== false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditTarget(row)}
                  >
                    {!row.school_id && row.is_active !== false ? 'Verifikasi' : 'Edit'}
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
        description="Kelola akun pengguna, verifikasi pendaftaran baru, dan penetapan peran sistem."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={loading} onClick={() => void reload()}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Muat Ulang
            </Button>
            {canManageUsers && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Pengguna
              </Button>
            )}
          </div>
        }
      />

      {/* Panel Verifikasi Akun Baru & Permohonan Perubahan Peran */}
      <PendingVerificationList
        users={pendingVerificationUsers}
        canManage={canManageUsers}
        loading={loading}
        error={error}
        showWhenEmpty={canManageUsers && roleFilter === 'pending'}
        onReload={() => void reload()}
        onApprove={(u, approvedRole) => verifyUser(u.id, approvedRole)}
        onReject={(u) => rejectVerification(u.id, !u.school_id)}
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
              {opt.value === 'pending' && pendingVerificationUsers.length > 0
                ? `${opt.label} (${pendingVerificationUsers.length})`
                : opt.label}
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
              : roleFilter === 'pending'
                ? 'Tidak ada akun atau permohonan peran yang menunggu verifikasi.'
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

      {/* Modal edit / verifikasi peran */}
      {editTarget && (
        <UserFormModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(userId, role) =>
            !editTarget.school_id
              ? verifyUser(userId, role).then(() => undefined)
              : updateRole(userId, role)
          }
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

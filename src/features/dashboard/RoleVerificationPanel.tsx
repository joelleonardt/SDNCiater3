import { useEffect, useState, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { requestRoleChange } from '@/services/authService'
import {
  getUsers,
  verifyUserAccount,
  rejectUserVerification,
  isUserPendingVerification,
  type Role,
} from '@/services/userService'
import PendingVerificationList from '@/features/users/PendingVerificationList'
import type { Profile } from '@/types/database.types'

const ROLE_LABELS: Record<Role, string> = {
  Guru: 'Guru',
  Kepala_Sekolah: 'Kepala Sekolah',
  Staf_Admin: 'Staf Admin',
}

export default function RoleVerificationPanel() {
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const pushToast = useUIStore((s) => s.pushToast)

  const [pendingUsers, setPendingUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancellingOwn, setCancellingOwn] = useState(false)

  const isAdmin = profile?.role === 'Staf_Admin'

  const loadPendingRequests = useCallback(async () => {
    if (!profile?.school_id || !isAdmin) {
      setPendingUsers([])
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const allUsers = await getUsers(profile.school_id)
      setPendingUsers(allUsers.filter(isUserPendingVerification))
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Gagal memuat daftar verifikasi pengguna.'
      )
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, isAdmin])

  useEffect(() => {
    void loadPendingRequests()
  }, [loadPendingRequests])

  async function handleApprove(user: Profile, approvedRole: Role) {
    if (!profile?.school_id) return
    const isNewAccount = !user.school_id
    try {
      await verifyUserAccount(user.id, profile.school_id, approvedRole)
      setPendingUsers((prev) => prev.filter((u) => u.id !== user.id))
      if (user.id === profile.id) {
        await refreshProfile()
      }
      pushToast({
        title: isNewAccount ? 'Akun diverifikasi' : 'Peran disetujui',
        description: isNewAccount
          ? `Akun ${user.full_name} berhasil diverifikasi sebagai ${ROLE_LABELS[approvedRole]}.`
          : `Peran ${user.full_name} berhasil diubah menjadi ${ROLE_LABELS[approvedRole]}.`,
        variant: 'default',
      })
    } catch (err) {
      pushToast({
        title: 'Gagal memverifikasi akun',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      })
      throw err
    }
  }

  async function handleReject(user: Profile) {
    const isNewAccount = !user.school_id
    try {
      await rejectUserVerification(user.id, isNewAccount)
      setPendingUsers((prev) => prev.filter((u) => u.id !== user.id))
      if (user.id === profile?.id) {
        await refreshProfile()
      }
      pushToast({
        title: isNewAccount ? 'Pendaftaran akun ditolak' : 'Permohonan ditolak',
        description: isNewAccount
          ? `Pendaftaran akun ${user.full_name} telah ditolak dan dinonaktifkan.`
          : `Permohonan perubahan peran ${user.full_name} telah ditolak.`,
        variant: 'default',
      })
    } catch (err) {
      pushToast({
        title: 'Gagal menolak permohonan',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      })
      throw err
    }
  }

  async function handleCancelOwnRequest() {
    if (!profile?.id) return
    setCancellingOwn(true)
    try {
      await requestRoleChange(profile.id, null)
      await refreshProfile()
      pushToast({
        title: 'Permohonan dibatalkan',
        description: 'Permohonan perubahan peran Anda telah dibatalkan.',
        variant: 'default',
      })
    } finally {
      setCancellingOwn(false)
    }
  }

  if (isAdmin && profile?.school_id) {
    return (
      <PendingVerificationList
        users={pendingUsers}
        canManage
        loading={loading}
        error={loadError}
        showWhenEmpty
        onReload={() => void loadPendingRequests()}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    )
  }

  if (
    !isAdmin &&
    profile?.school_id &&
    profile?.requested_role &&
    profile.requested_role !== profile.role
  ) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Permohonan Perubahan Peran Menunggu Verifikasi Admin
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              Anda mengajukan perubahan peran dari{' '}
              <strong>{ROLE_LABELS[profile.role]}</strong> menjadi{' '}
              <strong>{ROLE_LABELS[profile.requested_role]}</strong>. Peran akan otomatis berubah setelah disetujui oleh Staf Admin di Dashboard Admin.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={cancellingOwn}
          onClick={() => void handleCancelOwnRequest()}
        >
          Batalkan Permohonan
        </Button>
      </div>
    )
  }

  return null
}

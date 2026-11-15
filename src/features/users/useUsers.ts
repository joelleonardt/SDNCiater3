import { useCallback, useEffect, useState } from 'react'
import type { Profile } from '@/types/database.types'
import {
  getUsers,
  createUser,
  updateUserRole,
  rejectUserRoleRequest,
  verifyUserAccount,
  rejectUserVerification,
  toggleUserActive,
  type Role,
  type CreateUserInput,
} from '@/services/userService'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast/useToast'

export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schoolId = useAuthStore((s) => s.profile?.school_id ?? null)
  const { toastSuccess, toastError } = useToast()

  const reload = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers(schoolId)
      setUsers(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data pengguna'
      setError(msg)
      toastError('Gagal memuat pengguna', msg)
    } finally {
      setLoading(false)
    }
  }, [schoolId, toastError])

  useEffect(() => {
    reload()
  }, [reload])

  const addUser = useCallback(
    async (payload: Omit<CreateUserInput, 'school_id'>) => {
      if (!schoolId) throw new Error('Sekolah belum teridentifikasi')
      try {
        const created = await createUser({ ...payload, school_id: schoolId })
        setUsers((prev) => [created, ...prev])
        toastSuccess('Pengguna baru berhasil ditambahkan')
        return created
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menambahkan pengguna'
        toastError('Gagal menambahkan pengguna', msg)
        throw err
      }
    },
    [schoolId, toastSuccess, toastError]
  )

  const updateRole = useCallback(
    async (userId: string, role: Role) => {
      try {
        const updated = await updateUserRole(userId, role)
        setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
        toastSuccess('Peran pengguna berhasil diperbarui')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui peran'
        toastError('Gagal memperbarui peran', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  const toggleActive = useCallback(
    async (userId: string, isActive: boolean) => {
      // Optimistic update
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: isActive } : u)))
      try {
        const updated = await toggleUserActive(userId, isActive)
        setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
        toastSuccess(isActive ? 'Pengguna diaktifkan' : 'Pengguna dinonaktifkan')
      } catch (err) {
        // Rollback optimistic update
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: !isActive } : u)))
        const msg = err instanceof Error ? err.message : 'Gagal mengubah status pengguna'
        toastError('Gagal mengubah status', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  const rejectRole = useCallback(
    async (userId: string) => {
      try {
        const updated = await rejectUserRoleRequest(userId)
        setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
        toastSuccess('Permohonan perubahan peran ditolak')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menolak permohonan peran'
        toastError('Gagal menolak permohonan', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  const verifyUser = useCallback(
    async (userId: string, approvedRole: Role) => {
      if (!schoolId) throw new Error('Sekolah belum teridentifikasi')
      try {
        const updated = await verifyUserAccount(userId, schoolId, approvedRole)
        setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
        toastSuccess('Akun berhasil diverifikasi dan dihubungkan ke sekolah')
        return updated
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memverifikasi akun'
        toastError('Gagal memverifikasi akun', msg)
        throw err
      }
    },
    [schoolId, toastSuccess, toastError]
  )

  const rejectVerification = useCallback(
    async (userId: string, isNewUnlinkedAccount: boolean) => {
      try {
        const updated = await rejectUserVerification(userId, isNewUnlinkedAccount)
        setUsers((prev) =>
          isNewUnlinkedAccount
            ? prev.filter((u) => u.id !== userId)
            : prev.map((u) => (u.id === userId ? updated : u))
        )
        toastSuccess(
          isNewUnlinkedAccount
            ? 'Pendaftaran akun ditolak dan dinonaktifkan'
            : 'Permohonan perubahan peran ditolak'
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menolak verifikasi akun'
        toastError('Gagal menolak verifikasi', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  return {
    users,
    loading,
    error,
    reload,
    addUser,
    updateRole,
    rejectRole,
    verifyUser,
    rejectVerification,
    toggleActive,
  }
}

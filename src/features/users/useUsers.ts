import { useCallback, useEffect, useState } from 'react'
import type { Profile } from '@/types/database.types'
import { getUsers, updateUserRole, toggleUserActive } from '@/services/userService'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast/useToast'

type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

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

  return { users, loading, error, reload, updateRole, toggleActive }
}

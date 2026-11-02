import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast/useToast'
import {
  getSchedulesByClass,
  getSchedulesByTeacher,
  createSchedule as apiCreate,
  updateSchedule as apiUpdate,
  deleteSchedule as apiDelete,
} from '@/services/scheduleService'
import type { Schedule, ScheduleInsert, ScheduleUpdate } from '@/types/database.types'

/**
 * Hook untuk mengelola jadwal pelajaran.
 * - Jika classId diberikan: ambil jadwal kelas tersebut (Req 10.1)
 * - Jika tidak: ambil jadwal milik guru yang sedang login (Req 10.2)
 */
export function useSchedules(classId?: string) {
  const profile = useAuthStore((s) => s.profile)
  const { toastSuccess, toastError } = useToast()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!classId && !profile?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = classId
        ? await getSchedulesByClass(classId)
        : await getSchedulesByTeacher(profile!.id)
      setSchedules(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat jadwal'
      setError(msg)
      toastError(msg)
    } finally {
      setLoading(false)
    }
  }, [classId, profile?.id, toastError])

  useEffect(() => {
    reload()
  }, [reload])

  const createSchedule = useCallback(
    async (data: Omit<ScheduleInsert, 'id'>) => {
      try {
        const created = await apiCreate(data)
        setSchedules((prev) => [...prev, created])
        toastSuccess('Jadwal berhasil ditambahkan')
        return created
      } catch (err) {
        // shortcut: pesan error DB (misal UNIQUE violation) langsung dilempar ke caller
        const msg = err instanceof Error ? err.message : 'Gagal menambahkan jadwal'
        toastError(msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  const updateSchedule = useCallback(
    async (id: string, data: ScheduleUpdate) => {
      try {
        const updated = await apiUpdate(id, data)
        setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)))
        toastSuccess('Jadwal berhasil diperbarui')
        return updated
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui jadwal'
        toastError(msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  const deleteSchedule = useCallback(
    async (id: string) => {
      try {
        await apiDelete(id)
        setSchedules((prev) => prev.filter((s) => s.id !== id))
        toastSuccess('Jadwal berhasil dihapus')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menghapus jadwal'
        toastError(msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  return {
    schedules,
    loading,
    error,
    reload,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  }
}

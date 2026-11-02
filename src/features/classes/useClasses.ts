import { useCallback, useEffect, useState } from 'react'
import type { Class } from '@/types/database.types'
import {
  getClasses,
  createClass as svcCreate,
  updateClass as svcUpdate,
  deleteClass as svcDelete,
} from '@/services/classService'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/Toast/useToast'

export function useClasses() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schoolId = useAuthStore((s) => s.profile?.school_id ?? null)
  const academicYearId = useAppStore((s) => s.activeAcademicYear?.id ?? null)
  const { toastSuccess, toastError } = useToast()

  const reload = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getClasses(schoolId, academicYearId)
      setClasses(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data kelas'
      setError(msg)
      toastError('Gagal memuat kelas', msg)
    } finally {
      setLoading(false)
    }
  }, [schoolId, academicYearId, toastError])

  useEffect(() => {
    reload()
  }, [reload])

  const createClass = useCallback(
    async (data: {
      name: string
      grade_level: number
      homeroom_teacher_id?: string
    }) => {
      if (!schoolId || !academicYearId) {
        toastError('Gagal membuat kelas', 'Sekolah atau tahun ajaran belum dipilih')
        return
      }
      try {
        const created = await svcCreate({ ...data, school_id: schoolId, academic_year_id: academicYearId })
        setClasses((prev) => [...prev, created].sort((a, b) =>
          a.grade_level !== b.grade_level
            ? a.grade_level - b.grade_level
            : a.name.localeCompare(b.name)
        ))
        toastSuccess('Kelas berhasil dibuat')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal membuat kelas'
        toastError('Gagal membuat kelas', msg)
        throw err
      }
    },
    [schoolId, academicYearId, toastSuccess, toastError]
  )

  const updateClass = useCallback(
    async (id: string, data: { name?: string; grade_level?: number; homeroom_teacher_id?: string | null }) => {
      try {
        const updated = await svcUpdate(id, data)
        setClasses((prev) =>
          prev
            .map((c) => (c.id === id ? updated : c))
            .sort((a, b) =>
              a.grade_level !== b.grade_level
                ? a.grade_level - b.grade_level
                : a.name.localeCompare(b.name)
            )
        )
        toastSuccess('Kelas berhasil diperbarui')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui kelas'
        toastError('Gagal memperbarui kelas', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  const deleteClass = useCallback(
    async (id: string) => {
      try {
        await svcDelete(id)
        setClasses((prev) => prev.filter((c) => c.id !== id))
        toastSuccess('Kelas berhasil dihapus')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menghapus kelas'
        toastError('Gagal menghapus kelas', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  return { classes, loading, error, reload, createClass, updateClass, deleteClass }
}

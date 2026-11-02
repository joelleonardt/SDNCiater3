import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast/useToast'
import {
  getGradeComponents,
  getGrades,
  saveGradeComponents,
  saveGrades,
  type GradeComponent,
  type GradeRow,
} from '@/services/gradeService'

/**
 * Hook untuk mengelola komponen nilai dan input nilai siswa
 * dalam satu kelas pada satu semester.
 * Requirements: 18.1
 */
export function useGrades(classId: string, semesterId: string) {
  const { toastSuccess, toastError } = useToast()

  const [components, setComponents] = useState<GradeComponent[]>([])
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-load saat classId atau semesterId berubah
  useEffect(() => {
    if (!classId || !semesterId) {
      setComponents([])
      setGradeRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      getGradeComponents(classId, semesterId),
      getGrades(classId, semesterId),
    ])
      .then(([comps, rows]) => {
        if (cancelled) return
        setComponents(comps)
        setGradeRows(rows)
      })
      .catch(() => {
        if (!cancelled) toastError('Gagal memuat data nilai')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [classId, semesterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Simpan komponen nilai (delete + insert), lalu reload
  const saveComponentsFn = useCallback(
    async (newComponents: { name: string; weight: number }[]) => {
      setSaving(true)
      try {
        await saveGradeComponents(
          newComponents.map((c) => ({ ...c, class_id: classId, semester_id: semesterId }))
        )
        const [comps, rows] = await Promise.all([
          getGradeComponents(classId, semesterId),
          getGrades(classId, semesterId),
        ])
        setComponents(comps)
        setGradeRows(rows)
        toastSuccess('Komponen nilai berhasil disimpan')
      } catch {
        toastError('Gagal menyimpan komponen nilai')
      } finally {
        setSaving(false)
      }
    },
    [classId, semesterId, toastSuccess, toastError]
  )

  // Update satu nilai siswa secara lokal (optimistic — simpan via saveAllGrades)
  const updateScore = useCallback(
    (studentId: string, componentId: string, score: number) => {
      setGradeRows((prev) =>
        prev.map((row) =>
          row.student_id === studentId
            ? { ...row, grades: { ...row.grades, [componentId]: score } }
            : row
        )
      )
    },
    []
  )

  // Simpan semua nilai yang ada di state ke database
  const saveAllGrades = useCallback(async () => {
    const payload: { student_id: string; grade_component_id: string; score: number }[] = []
    for (const row of gradeRows) {
      for (const [componentId, score] of Object.entries(row.grades)) {
        payload.push({ student_id: row.student_id, grade_component_id: componentId, score })
      }
    }
    if (payload.length === 0) return
    setSaving(true)
    try {
      await saveGrades(payload)
      toastSuccess('Nilai berhasil disimpan')
    } catch {
      toastError('Gagal menyimpan nilai')
    } finally {
      setSaving(false)
    }
  }, [gradeRows, toastSuccess, toastError])

  return {
    components,
    gradeRows,
    loading,
    saving,
    saveComponents: saveComponentsFn,
    updateScore,
    saveAllGrades,
  }
}

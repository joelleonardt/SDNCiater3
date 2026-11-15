import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/Toast/useToast'
import { getErrorMessage } from '@/lib/utils'
import {
  getAttendanceByClassAndDate,
  saveAttendance,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/services/attendanceService'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Hook untuk mengelola kehadiran satu kelas pada satu tanggal.
 * Requirements: 9.4–9.6
 */
export function useAttendance() {
  const { toastSuccess, toastError } = useToast()

  const [classId, setClassIdState] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const recordsRef = useRef<AttendanceRecord[]>([])
  const scopeRef = useRef({ classId: null as string | null, selectedDate: todayISO() })

  scopeRef.current = { classId, selectedDate }

  // Auto-fetch saat classId atau selectedDate berubah (Req 9.4)
  useEffect(() => {
    if (!classId) {
      recordsRef.current = []
      setRecords([])
      return
    }
    let cancelled = false
    setLoading(true)
    getAttendanceByClassAndDate(classId, selectedDate)
      .then((data) => {
        if (!cancelled) {
          recordsRef.current = data
          setRecords(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          recordsRef.current = []
          setRecords([])
          toastError('Gagal memuat data kehadiran', getErrorMessage(err, 'Terjadi kesalahan saat memuat kehadiran.'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classId, selectedDate, toastError])

  const setClassId = useCallback((id: string) => {
    setClassIdState(id)
  }, [])

  const setDate = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  // Optimistic update satu siswa, rollback hanya siswa terkait saat gagal (Req 9.5)
  const updateStatus = useCallback(
    async (studentId: string, status: AttendanceStatus) => {
      if (!classId) return
      const currentTarget = recordsRef.current.find((r) => r.student_id === studentId)
      if (!currentTarget) return

      const previousStatus = currentTarget.status

      recordsRef.current = recordsRef.current.map((r) =>
        r.student_id === studentId ? { ...r, status } : r
      )
      setRecords((curr) =>
        curr.map((r) => (r.student_id === studentId ? { ...r, status } : r))
      )

      try {
        await saveAttendance([{ class_id: classId, student_id: studentId, date: selectedDate, status }])
      } catch (err) {
        if (scopeRef.current.classId === classId && scopeRef.current.selectedDate === selectedDate) {
          recordsRef.current = recordsRef.current.map((r) =>
            r.student_id === studentId ? { ...r, status: previousStatus } : r
          )
          setRecords((curr) =>
            curr.map((r) => (r.student_id === studentId ? { ...r, status: previousStatus } : r))
          )
        }
        toastError('Gagal memperbarui status kehadiran', getErrorMessage(err, 'Terjadi kesalahan saat menyimpan kehadiran.'))
      }
    },
    [classId, selectedDate, toastError]
  )

  // Optimistic batch update semua siswa ke satu status sekaligus dan simpan dalam 1 request
  const markAllStatus = useCallback(
    async (status: AttendanceStatus) => {
      if (!classId) return
      const snapshot = recordsRef.current
      if (snapshot.length === 0) return

      const updated = snapshot.map((r) =>
        r.status === status ? r : { ...r, status }
      )
      recordsRef.current = updated
      setRecords((curr) =>
        curr.map((r) => (r.status === status ? r : { ...r, status }))
      )

      setSaving(true)
      try {
        await saveAttendance(
          updated.map((r) => ({
            class_id: classId,
            student_id: r.student_id,
            date: selectedDate,
            status,
          }))
        )
        toastSuccess(`Semua siswa ditandai ${status}`)
      } catch (err) {
        if (scopeRef.current.classId === classId && scopeRef.current.selectedDate === selectedDate) {
          recordsRef.current = snapshot
          setRecords(snapshot)
        }
        toastError('Gagal memperbarui status kehadiran', getErrorMessage(err, 'Terjadi kesalahan saat menyimpan kehadiran.'))
      } finally {
        setSaving(false)
      }
    },
    [classId, selectedDate, toastSuccess, toastError]
  )

  // Simpan semua records (Req 9.6)
  async function save() {
    if (!classId || recordsRef.current.length === 0) return
    setSaving(true)
    try {
      await saveAttendance(recordsRef.current)
      toastSuccess('Kehadiran berhasil disimpan')
    } catch (err) {
      toastError('Gagal menyimpan kehadiran', getErrorMessage(err, 'Terjadi kesalahan saat menyimpan kehadiran.'))
    } finally {
      setSaving(false)
    }
  }

  return {
    classId,
    selectedDate,
    records,
    loading,
    saving,
    setClassId,
    setDate,
    updateStatus,
    markAllStatus,
    save,
  }
}

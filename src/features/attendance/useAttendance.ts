import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast/useToast'
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

  // Auto-fetch saat classId atau selectedDate berubah (Req 9.4)
  useEffect(() => {
    if (!classId) {
      setRecords([])
      return
    }
    let cancelled = false
    setLoading(true)
    getAttendanceByClassAndDate(classId, selectedDate)
      .then((data) => { if (!cancelled) setRecords(data) })
      .catch(() => { if (!cancelled) setRecords([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId, selectedDate])

  function setClassId(id: string) {
    setClassIdState(id)
  }

  function setDate(date: string) {
    setSelectedDate(date)
  }

  // Optimistic update satu siswa, rollback saat gagal (Req 9.5)
  const updateStatus = useCallback(
    async (studentId: string, status: AttendanceStatus) => {
      if (!classId) return
      const prev = records
      const updated = records.map((r) =>
        r.student_id === studentId ? { ...r, status } : r
      )
      setRecords(updated)

      const target = updated.find((r) => r.student_id === studentId)
      if (!target) return

      try {
        await saveAttendance([{ class_id: classId, student_id: studentId, date: selectedDate, status }])
      } catch {
        setRecords(prev) // rollback
        toastError('Gagal memperbarui status kehadiran')
      }
    },
    [classId, selectedDate, records, toastError]
  )

  // Simpan semua records (Req 9.6)
  async function save() {
    if (!classId || records.length === 0) return
    setSaving(true)
    try {
      await saveAttendance(records)
      toastSuccess('Kehadiran berhasil disimpan')
    } catch {
      toastError('Gagal menyimpan kehadiran')
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
    save,
  }
}

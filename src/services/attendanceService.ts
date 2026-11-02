import { supabase } from './supabase'
import type { Student } from '@/types/database.types'

// ─── Tipe ─────────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'

export interface AttendanceInput {
  class_id: string
  student_id: string
  date: string
  status: AttendanceStatus
}

export interface AttendanceRecord extends AttendanceInput {
  id: string
}

export interface AttendanceRecap {
  student_id: string
  full_name: string
  hadir: number
  sakit: number
  izin: number
  alpa: number
  total: number
  persentase_hadir: number
}

// ─── Fungsi query ──────────────────────────────────────────────────────────────

/**
 * Ambil record kehadiran satu kelas pada tanggal tertentu.
 * Requirements: 9.1
 */
export async function getAttendanceByClassAndDate(
  classId: string,
  date: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, class_id, student_id, date, status')
    .eq('class_id', classId)
    .eq('date', date)

  if (error) throw new Error(error.message)
  return (data ?? []) as AttendanceRecord[]
}

/**
 * Upsert kehadiran berdasarkan (class_id, student_id, date).
 * Requirements: 9.2
 */
export async function saveAttendance(records: AttendanceInput[]): Promise<void> {
  if (records.length === 0) return

  const { error } = await supabase
    .from('attendance')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(records as any, { onConflict: 'class_id,student_id,date' })

  if (error) throw new Error(error.message)
}

/**
 * Rekap kehadiran per siswa dalam rentang tanggal.
 * Query attendance JOIN students, kelompokkan di JS.
 * Requirements: 9.3
 */
export async function getAttendanceRecap(
  classId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceRecap[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('attendance')
    .select('student_id, status, students(full_name)')
    .eq('class_id', classId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(error.message)

  // Kelompokkan per siswa di JS
  const map = new Map<
    string,
    { full_name: string; hadir: number; sakit: number; izin: number; alpa: number }
  >()

  for (const row of (data ?? []) as Array<{
    student_id: string
    status: AttendanceStatus
    students: Student | null
  }>) {
    const fullName = row.students?.full_name ?? ''
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { full_name: fullName, hadir: 0, sakit: 0, izin: 0, alpa: 0 })
    }
    const c = map.get(row.student_id)!
    if (row.status === 'Hadir') c.hadir++
    else if (row.status === 'Sakit') c.sakit++
    else if (row.status === 'Izin') c.izin++
    else if (row.status === 'Alpa') c.alpa++
  }

  return Array.from(map.entries()).map(([student_id, c]) => {
    const total = c.hadir + c.sakit + c.izin + c.alpa
    return {
      student_id,
      full_name: c.full_name,
      hadir: c.hadir,
      sakit: c.sakit,
      izin: c.izin,
      alpa: c.alpa,
      total,
      persentase_hadir: total > 0 ? Math.round((c.hadir / total) * 100 * 10) / 10 : 0,
    }
  })
}

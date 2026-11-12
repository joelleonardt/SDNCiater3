import { supabase } from './supabase'
import type { Student } from '@/types/database.types'

// ─── Tipe ─────────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa'

export interface AttendanceInput {
  class_id: string
  student_id: string
  date: string
  status: AttendanceStatus
}

export interface AttendanceRecord extends AttendanceInput {
  id: string
  student_name?: string
  student_nis?: string
}

export interface AttendanceRecap {
  student_id: string
  full_name: string
  hadir: number
  sakit: number
  izin: number
  alpa: number
  alfa: number
  total: number
  persentase_hadir: number
}

// ─── Fungsi query ──────────────────────────────────────────────────────────────

/**
 * Ambil daftar kehadiran satu kelas pada tanggal tertentu.
 * Mengambil seluruh siswa aktif yang terdaftar di kelas tersebut, lalu
 * menggabungkannya dengan record kehadiran yang sudah ada pada tanggal itu
 * (default 'Hadir' bila belum pernah diisi pada tanggal tersebut).
 * Requirements: 7.2, 7.3, 7.7
 */
export async function getAttendanceByClassAndDate(
  classId: string,
  date: string
): Promise<AttendanceRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrolledRes, attendanceRes] = await Promise.all([
    (supabase as any)
      .from('class_students')
      .select('student_id, students!inner(id, nis, full_name, is_deleted)')
      .eq('class_id', classId)
      .eq('students.is_deleted', false),
    supabase
      .from('attendance')
      .select('id, class_id, student_id, date, status')
      .eq('class_id', classId)
      .eq('date', date),
  ])

  if (enrolledRes.error) throw new Error(enrolledRes.error.message)
  if (attendanceRes.error) throw new Error(attendanceRes.error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingMap = new Map<string, { id: string; status: AttendanceStatus }>()
  for (const row of (attendanceRes.data ?? []) as Array<{
    id: string
    student_id: string
    status: string
  }>) {
    const normalizedStatus: AttendanceStatus =
      row.status === 'Alpa' ? 'Alfa' : (row.status as AttendanceStatus)
    existingMap.set(row.student_id, { id: row.id, status: normalizedStatus })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrolledRows = ((enrolledRes.data ?? []) as any[]).sort((a, b) =>
    String(a.students?.full_name ?? '').localeCompare(
      String(b.students?.full_name ?? ''),
      'id'
    )
  )

  return enrolledRows.map((row) => {
    const studentId = row.student_id as string
    const existing = existingMap.get(studentId)
    return {
      id: existing?.id ?? `${classId}-${studentId}-${date}`,
      class_id: classId,
      student_id: studentId,
      date,
      status: existing?.status ?? 'Hadir',
      student_name: row.students?.full_name ?? '—',
      student_nis: row.students?.nis ?? '—',
    }
  })
}

/**
 * Upsert kehadiran berdasarkan (class_id, student_id, date).
 * Requirements: 7.4, 7.6
 */
export async function saveAttendance(records: AttendanceInput[]): Promise<void> {
  if (records.length === 0) return

  const payload = records.map((r) => ({
    class_id: r.class_id,
    student_id: r.student_id,
    date: r.date,
    status: (r.status as string) === 'Alpa' ? 'Alfa' : r.status,
  }))

  const { error } = await supabase
    .from('attendance')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(payload as any, { onConflict: 'class_id,student_id,date' })

  if (error) throw new Error(error.message)
}

/**
 * Rekap kehadiran per siswa dalam rentang tanggal.
 * Query attendance JOIN students, kelompokkan di JS.
 * Requirements: 7.8, 7.9
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
    { full_name: string; hadir: number; sakit: number; izin: number; alfa: number }
  >()

  for (const row of (data ?? []) as Array<{
    student_id: string
    status: string
    students: Student | null
  }>) {
    const fullName = row.students?.full_name ?? ''
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { full_name: fullName, hadir: 0, sakit: 0, izin: 0, alfa: 0 })
    }
    const c = map.get(row.student_id)!
    if (row.status === 'Hadir') c.hadir++
    else if (row.status === 'Sakit') c.sakit++
    else if (row.status === 'Izin') c.izin++
    else if (row.status === 'Alfa' || row.status === 'Alpa') c.alfa++
  }

  return Array.from(map.entries()).map(([student_id, c]) => {
    const total = c.hadir + c.sakit + c.izin + c.alfa
    return {
      student_id,
      full_name: c.full_name,
      hadir: c.hadir,
      sakit: c.sakit,
      izin: c.izin,
      alpa: c.alfa,
      alfa: c.alfa,
      total,
      persentase_hadir: total > 0 ? Math.round((c.hadir / total) * 100 * 10) / 10 : 0,
    }
  })
}

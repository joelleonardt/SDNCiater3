import { supabase } from '@/services/supabase'
import { calculateAttendancePercentage, getErrorMessage } from '@/lib/utils'
import type { Profile } from '@/types/database.types'

type Role = Profile['role']

export interface DashboardSummary {
  totalSiswa: number
  totalKelas: number
  /** Persentase kehadiran hari ini (0–100, 1 desimal), atau null jika tidak ada data */
  persentaseKehadiran: number | null
  totalCatatan7Hari: number
}

export interface TodayScheduleItem {
  id: string
  subject: string
  class_name: string
  start_time: string
  end_time: string
}

export interface DashboardNoteItem {
  id: string
  student_name: string
  category: 'Perilaku' | 'Prestasi'
  content: string
  note_date: string
}

export interface WeeklyAttendanceDay {
  label: string
  tanggal: string
  persen: number
  total: number
}

/**
 * Mengambil data ringkasan untuk dashboard.
 * @param schoolId        ID sekolah dari profil pengguna
 * @param academicYearId  ID tahun ajaran aktif (opsional, untuk filter kelas)
 */
export async function getDashboardSummary(
  schoolId: string,
  academicYearId: string | null,
): Promise<DashboardSummary> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

  // Ambil class IDs sekolah untuk filter attendance
  const classResult = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
  if (classResult.error) {
    throw new Error(getErrorMessage(classResult.error, 'Gagal memuat ringkasan kelas.'))
  }
  // shortcut: cast karena Supabase typed-client tidak meng-infer subset kolom dengan benar
  const classIds: string[] = ((classResult.data ?? []) as Array<{ id: string }>).map((c) => c.id)

  // Ambil student IDs aktif sekolah untuk filter catatan
  const studentResult = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_deleted', false)
  if (studentResult.error) {
    throw new Error(getErrorMessage(studentResult.error, 'Gagal memuat ringkasan siswa.'))
  }
  const studentIds: string[] = ((studentResult.data ?? []) as Array<{ id: string }>).map((s) => s.id)

  // Jalankan query utama secara paralel
  const kelasQuery = academicYearId
    ? supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYearId)
    : supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)

  const [siswaResult, kelasResult, kehadiranResult, catatanResult] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false),

    kelasQuery,

    classIds.length > 0
      ? supabase
          .from('attendance')
          .select('status')
          .eq('date', today)
          .in('class_id', classIds)
      : Promise.resolve({ data: [] as { status: string }[], error: null }),

    studentIds.length > 0
      ? supabase
          .from('notes')
          .select('id', { count: 'exact', head: true })
          .gte('note_date', sevenDaysAgoStr)
          .lte('note_date', today)
          .in('student_id', studentIds)
      : Promise.resolve({ data: null, count: 0, error: null }),
  ])

  const firstError =
    siswaResult.error ?? kelasResult.error ?? kehadiranResult.error ?? catatanResult.error
  if (firstError) {
    throw new Error(getErrorMessage(firstError, 'Gagal memuat ringkasan dashboard.'))
  }

  const totalSiswa = siswaResult.count ?? 0
  const totalKelas = kelasResult.count ?? 0
  const totalCatatan7Hari = catatanResult.count ?? 0

  // Hitung persentase kehadiran hari ini: (jumlah Hadir / total siswa aktif) * 100 (1 desimal, Req 4.1)
  let persentaseKehadiran: number | null = null
  const attendanceData = kehadiranResult.data
  if (attendanceData && attendanceData.length > 0 && totalSiswa > 0) {
    const hadir = attendanceData.filter((r) => r.status === 'Hadir').length
    persentaseKehadiran = calculateAttendancePercentage(hadir, totalSiswa)
  }

  return { totalSiswa, totalKelas, persentaseKehadiran, totalCatatan7Hari }
}

/**
 * Mengambil jadwal kelas hari ini.
 * - Guru: jadwal mengajar guru tersebut hari ini
 * - Staf_Admin / Kepala_Sekolah: semua jadwal kelas di sekolah hari ini
 * Diurutkan berdasarkan start_time ASC (Req 4.2).
 */
export async function getTodaySchedules(
  schoolId: string,
  profileId: string,
  role: Role,
  dayOfWeek: number,
): Promise<TodayScheduleItem[]> {
  if (dayOfWeek < 1 || dayOfWeek > 6) return []

  let query = supabase
    .from('schedules')
    .select('id, subject, start_time, end_time, classes!inner(name, school_id)')
    .eq('classes.school_id', schoolId)
    .eq('day_of_week', dayOfWeek)
    .order('start_time', { ascending: true })

  if (role === 'Guru') {
    query = query.eq('teacher_id', profileId)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await query) as { data: any[] | null; error: unknown }
  if (error || !data) return []

  return data.map((row) => ({
    id: row.id as string,
    subject: row.subject as string,
    class_name: (row.classes as { name: string } | null)?.name ?? '—',
    start_time: row.start_time as string,
    end_time: row.end_time as string,
  }))
}

/**
 * Mengambil 5 catatan terbaru di sekolah dalam 7 hari terakhir untuk panel Dashboard (Req 4.3).
 */
export async function getRecentNotesForDashboard(
  schoolId: string,
): Promise<DashboardNoteItem[]> {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  const sevenDaysAgoStr = d.toISOString().slice(0, 10)

  const { data, error } = (await supabase
    .from('notes')
    .select('id, category, content, note_date, students!inner(id, school_id, full_name)')
    .eq('students.school_id', schoolId)
    .gte('note_date', sevenDaysAgoStr)
    .order('note_date', { ascending: false })
    .limit(5)) as {
    data: Array<{
      id: string
      category: 'Perilaku' | 'Prestasi'
      content: string
      note_date: string
      students: { full_name: string } | null
    }> | null
    error: unknown
  }

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    category: row.category,
    content: row.content,
    note_date: row.note_date,
    student_name: row.students?.full_name ?? '—',
  }))
}

const HARI_LABEL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/**
 * Menghasilkan daftar tanggal (YYYY-MM-DD) untuk minggu berjalan (Senin s.d. Minggu, Req 4.4).
 */
export function getCurrentWeekDates(referenceDate: Date = new Date()): string[] {
  const current = new Date(referenceDate)
  const day = current.getDay() // 0=Minggu, 1=Senin, ..., 6=Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(current)
  monday.setDate(current.getDate() + diffToMonday)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
  }
  return dates
}

/**
 * Mengambil persentase kehadiran harian untuk minggu berjalan (Senin–Minggu, Req 4.4).
 */
export async function getWeeklyAttendanceData(
  schoolId: string,
): Promise<WeeklyAttendanceDay[]> {
  const tanggalList = getCurrentWeekDates()
  const dari = tanggalList[0]
  const sampai = tanggalList[tanggalList.length - 1]

  const [siswaCountRes, attendanceRes] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_deleted', false),
    supabase
      .from('attendance')
      .select('date, status, class_id, classes!inner(school_id)')
      .eq('classes.school_id', schoolId)
      .gte('date', dari)
      .lte('date', sampai) as unknown as Promise<{
        data: Array<{ date: string; status: string }> | null
        error: Error | null
      }>,
  ])

  if (attendanceRes.error) {
    throw attendanceRes.error
  }

  const totalSiswa = siswaCountRes.count ?? 0
  const perTanggal: Record<string, { hadir: number; total: number }> = {}
  tanggalList.forEach((t) => {
    perTanggal[t] = { hadir: 0, total: 0 }
  })

  for (const row of attendanceRes.data ?? []) {
    if (perTanggal[row.date]) {
      perTanggal[row.date].total++
      if (row.status === 'Hadir') perTanggal[row.date].hadir++
    }
  }

  return tanggalList.map((tanggal, index) => {
    const { hadir, total } = perTanggal[tanggal]
    const denominator = totalSiswa > 0 ? totalSiswa : total
    return {
      label: HARI_LABEL[index],
      tanggal,
      persen: total > 0 && denominator > 0 ? calculateAttendancePercentage(hadir, denominator) : 0,
      total,
    }
  })
}

import { supabase } from '@/services/supabase'

export interface DashboardSummary {
  totalSiswa: number
  totalKelas: number
  /** Persentase kehadiran hari ini (0–100), atau null jika tidak ada data */
  persentaseKehadiran: number | null
  totalCatatan7Hari: number
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
  // shortcut: cast karena Supabase typed-client tidak meng-infer subset kolom dengan benar
  const classIds: string[] = ((classResult.data ?? []) as Array<{ id: string }>).map((c) => c.id)

  // Ambil student IDs aktif sekolah untuk filter catatan
  const studentResult = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_deleted', false)
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

  const totalSiswa = siswaResult.count ?? 0
  const totalKelas = kelasResult.count ?? 0
  const totalCatatan7Hari = catatanResult.count ?? 0

  // Hitung persentase kehadiran hari ini
  let persentaseKehadiran: number | null = null
  const attendanceData = kehadiranResult.data
  if (attendanceData && attendanceData.length > 0) {
    const hadir = attendanceData.filter((r) => r.status === 'Hadir').length
    persentaseKehadiran = Math.round((hadir / attendanceData.length) * 100)
  }

  return { totalSiswa, totalKelas, persentaseKehadiran, totalCatatan7Hari }
}

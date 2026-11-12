import type { Student, Class } from '@/types/database.types'
import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StudentWithClass = Student & {
  class_id?: string | null
  class_name?: string | null
}

export interface StudentFilters {
  search?: string   // cari berdasarkan full_name, nis, atau nama kelas
  gender?: string   // 'Laki-laki' | 'Perempuan'
  classId?: string  // filter berdasarkan keanggotaan kelas
}

export interface PaginatedResult<T> {
  data: T[]
  totalCount: number
}

export interface StudentAttendanceSummary {
  hadir: number
  sakit: number
  izin: number
  alfa: number
}

export type CreateStudentInput = Omit<Student, 'id' | 'created_at' | 'is_deleted'>
export type UpdateStudentInput = Partial<Omit<Student, 'id' | 'created_at' | 'school_id'>>

// ─── studentService ───────────────────────────────────────────────────────────

/**
 * Ambil daftar siswa dengan pagination, pencarian, dan filter,
 * beserta kelas tempat siswa terdaftar (Req 6.1, 6.2).
 * Hanya siswa yang belum dihapus (is_deleted = false) yang dikembalikan.
 */
export async function getStudents(
  filters: StudentFilters,
  page: number,
  pageSize: number
): Promise<PaginatedResult<StudentWithClass>> {
  const from = page * pageSize
  const to = from + pageSize - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('students')
    .select('*, class_students(class_id, classes(id, name))', { count: 'exact' })
    .eq('is_deleted', false)
    .order('full_name', { ascending: true })

  if (filters.search) {
    const q = filters.search.trim()
    // Cari apakah ada kelas dengan nama yang cocok untuk mendukung pencarian via kelas (Req 6.2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchedClasses } = await (supabase as any)
      .from('classes')
      .select('id')
      .ilike('name', `%${q}%`)

    const matchedClassIds = ((matchedClasses ?? []) as Array<{ id: string }>).map((c) => c.id)
    let classStudentIds: string[] = []
    if (matchedClassIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: csRows } = await (supabase as any)
        .from('class_students')
        .select('student_id')
        .in('class_id', matchedClassIds)
      classStudentIds = ((csRows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id)
    }

    if (classStudentIds.length > 0) {
      query = query.or(
        `full_name.ilike.%${q}%,nis.ilike.%${q}%,id.in.(${classStudentIds.join(',')})`
      )
    } else {
      query = query.or(`full_name.ilike.%${q}%,nis.ilike.%${q}%`)
    }
  }

  if (filters.gender) {
    query = query.eq('gender', filters.gender)
  }

  if (filters.classId) {
    // Filter melalui tabel relasi class_students
    const { data: ids, error: relError } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', filters.classId)

    if (relError) throw relError

    const studentIds = (ids ?? []).map((r) => (r as { student_id: string }).student_id)
    // Jika tidak ada siswa di kelas, kembalikan hasil kosong langsung
    if (studentIds.length === 0) return { data: [], totalCount: 0 }

    query = query.in('id', studentIds)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) throw error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped: StudentWithClass[] = ((data ?? []) as any[]).map((row) => {
    const enrollments = Array.isArray(row.class_students) ? row.class_students : []
    const firstEnrollment = enrollments[0]
    return {
      id: row.id,
      school_id: row.school_id,
      nis: row.nis,
      full_name: row.full_name,
      gender: row.gender,
      date_of_birth: row.date_of_birth,
      parent_name: row.parent_name,
      parent_contact: row.parent_contact,
      is_deleted: row.is_deleted,
      created_at: row.created_at,
      class_id: firstEnrollment?.class_id ?? null,
      class_name: firstEnrollment?.classes?.name ?? null,
    }
  })

  return { data: mapped, totalCount: count ?? 0 }
}

/**
 * Ambil detail satu siswa berdasarkan id.
 * Requirements: 6.5
 */
export async function getStudentById(id: string): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Ambil daftar kelas tempat seorang siswa terdaftar.
 */
export async function getStudentClasses(studentId: string): Promise<Class[]> {
  const { data, error } = await supabase
    .from('class_students')
    .select('class_id, classes(*)')
    .eq('student_id', studentId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => (row as { class_id: string; classes: Class | null }).classes)
    .filter((c): c is Class => c !== null)
}

/**
 * Ambil ringkasan kehadiran untuk satu siswa (Req 6.5).
 */
export async function getStudentAttendanceSummary(
  studentId: string
): Promise<StudentAttendanceSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('attendance')
    .select('status')
    .eq('student_id', studentId)

  if (error) throw new Error(error.message)

  const summary: StudentAttendanceSummary = { hadir: 0, sakit: 0, izin: 0, alfa: 0 }
  for (const row of (data ?? []) as Array<{ status: string }>) {
    if (row.status === 'Hadir') summary.hadir++
    else if (row.status === 'Sakit') summary.sakit++
    else if (row.status === 'Izin') summary.izin++
    else if (row.status === 'Alfa') summary.alfa++
  }
  return summary
}

/**
 * Daftarkan atau perbarui kelas siswa untuk suatu tahun ajaran (Req 6.4, 6.10).
 * Mencegah seorang siswa terdaftar di lebih dari satu Kelas pada Tahun_Ajaran yang sama.
 */
export async function setStudentClassEnrollment(
  studentId: string,
  classId: string | null | undefined,
  academicYearId?: string | null
): Promise<void> {
  if (!classId) return

  // Jika academicYearId diberikan, hapus pendaftaran lama siswa pada tahun ajaran yang sama
  if (academicYearId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: yearClasses } = await (supabase as any)
      .from('classes')
      .select('id')
      .eq('academic_year_id', academicYearId)

    const yearClassIds = ((yearClasses ?? []) as Array<{ id: string }>).map((c) => c.id)
    if (yearClassIds.length > 0) {
      await supabase
        .from('class_students')
        .delete()
        .eq('student_id', studentId)
        .in('class_id', yearClassIds)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('class_students') as any).upsert(
    { class_id: classId, student_id: studentId },
    { onConflict: 'class_id,student_id' }
  )
  if (error) throw new Error(error.message)
}

/**
 * Tambah siswa baru.
 * Requirements: 6.4, 6.9
 */
export async function createStudent(
  input: CreateStudentInput,
  classId?: string | null,
  academicYearId?: string | null
): Promise<Student> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('students') as any)
    .insert({ ...input, is_deleted: false })
    .select()
    .single()

  if (error) {
    if (error.code === '23505' || String(error.message).toLowerCase().includes('duplicate')) {
      throw new Error('NIS sudah terdaftar di sekolah ini.')
    }
    throw new Error(error.message)
  }

  const created = data as Student
  if (classId) {
    await setStudentClassEnrollment(created.id, classId, academicYearId)
  }
  return created
}

/**
 * Perbarui data siswa.
 * Requirements: 6.6, 6.9
 */
export async function updateStudent(
  id: string,
  input: UpdateStudentInput,
  classId?: string | null,
  academicYearId?: string | null
): Promise<Student> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('students') as any)
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505' || String(error.message).toLowerCase().includes('duplicate')) {
      throw new Error('NIS sudah terdaftar di sekolah ini.')
    }
    throw new Error(error.message)
  }

  if (classId) {
    await setStudentClassEnrollment(id, classId, academicYearId)
  }
  return data as Student
}

/**
 * Soft-delete siswa: set is_deleted = true.
 * Data tetap ada di database untuk keperluan historis.
 * Requirements: 6.7
 */
export async function softDeleteStudent(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('students') as any)
    .update({ is_deleted: true })
    .eq('id', id)

  if (error) throw error
}

import type { Student } from '@/types/database.types'
import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentFilters {
  search?: string   // cari berdasarkan full_name atau nis
  gender?: string   // 'Laki-laki' | 'Perempuan'
  classId?: string  // filter berdasarkan keanggotaan kelas
}

export interface PaginatedResult<T> {
  data: T[]
  totalCount: number
}

export type CreateStudentInput = Omit<Student, 'id' | 'created_at' | 'is_deleted'>
export type UpdateStudentInput = Partial<Omit<Student, 'id' | 'created_at' | 'school_id'>>

// ─── studentService ───────────────────────────────────────────────────────────

/**
 * Ambil daftar siswa dengan pagination, pencarian, dan filter.
 * Hanya siswa yang belum dihapus (is_deleted = false) yang dikembalikan.
 * Requirements: 8.1, 8.2
 */
export async function getStudents(
  filters: StudentFilters,
  page: number,
  pageSize: number
): Promise<PaginatedResult<Student>> {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('students')
    .select('*', { count: 'exact' })
    .eq('is_deleted', false)
    .order('full_name', { ascending: true })
    .range(from, to)

  if (filters.search) {
    // PostgREST: OR filter pada dua kolom
    query = query.or(
      `full_name.ilike.%${filters.search}%,nis.ilike.%${filters.search}%`
    )
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

  const { data, error, count } = await query

  if (error) throw error

  return { data: data ?? [], totalCount: count ?? 0 }
}

/**
 * Ambil detail satu siswa berdasarkan id.
 * Requirements: 8.3
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
 * Tambah siswa baru.
 * Requirements: 8.4
 */
export async function createStudent(input: CreateStudentInput): Promise<Student> {
  // shortcut: Supabase JS v2 TS generic inference returns `never[]` for .insert()
  // pada moduleResolution:bundler; cast via unknown adalah workaround standar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('students') as any)
    .insert({ ...input, is_deleted: false })
    .select()
    .single()

  if (error) throw error
  return data as Student
}

/**
 * Perbarui data siswa.
 * Requirements: 8.5
 */
export async function updateStudent(
  id: string,
  input: UpdateStudentInput
): Promise<Student> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('students') as any)
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Student
}

/**
 * Soft-delete siswa: set is_deleted = true.
 * Data tetap ada di database untuk keperluan historis.
 * Requirements: 8.6
 */
export async function softDeleteStudent(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('students') as any)
    .update({ is_deleted: true })
    .eq('id', id)

  if (error) throw error
}

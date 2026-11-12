import type { Class } from '@/types/database.types'
import { supabase } from './supabase'

export type ClassWithDetails = Class & {
  homeroom_teacher_name?: string | null
  student_count?: number
}

/**
 * Ambil semua kelas berdasarkan school_id dan academic_year_id,
 * dilengkapi dengan nama wali kelas dan jumlah siswa terdaftar (Req 5.1).
 * Jika academic_year_id null, kembalikan array kosong.
 */
export async function getClasses(
  schoolId: string,
  academicYearId: string | null
): Promise<ClassWithDetails[]> {
  if (!academicYearId) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('classes')
    .select('*, profiles(full_name), class_students(count)')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .order('grade_level', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    school_id: row.school_id,
    academic_year_id: row.academic_year_id,
    name: row.name,
    grade_level: row.grade_level,
    homeroom_teacher_id: row.homeroom_teacher_id,
    created_at: row.created_at,
    homeroom_teacher_name: row.profiles?.full_name ?? null,
    student_count: Array.isArray(row.class_students)
      ? (row.class_students[0]?.count ?? 0)
      : 0,
  }))
}

/**
 * Buat kelas baru.
 */
export async function createClass(data: {
  school_id: string
  academic_year_id: string
  name: string
  grade_level: number
  homeroom_teacher_id?: string | null
}): Promise<Class> {
  const { data: created, error } = await supabase
    .from('classes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(data as any)
    .select()
    .single()

  if (error) {
    if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
      throw new Error('Nama kelas sudah digunakan pada tahun ajaran ini.')
    }
    throw new Error(error.message)
  }
  return created
}

/**
 * Perbarui data kelas berdasarkan id.
 */
export async function updateClass(
  id: string,
  data: { name?: string; grade_level?: number; homeroom_teacher_id?: string | null }
): Promise<Class> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('classes')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
      throw new Error('Nama kelas sudah digunakan pada tahun ajaran ini.')
    }
    throw new Error(error.message)
  }
  return updated as Class
}

/**
 * Hapus kelas berdasarkan id.
 */
export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

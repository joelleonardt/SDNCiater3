import type { Class } from '@/types/database.types'
import { supabase } from './supabase'

/**
 * Ambil semua kelas berdasarkan school_id dan academic_year_id.
 * Jika academic_year_id null, kembalikan array kosong.
 */
export async function getClasses(
  schoolId: string,
  academicYearId: string | null
): Promise<Class[]> {
  if (!academicYearId) return []

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .order('grade_level', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Buat kelas baru.
 */
export async function createClass(data: {
  school_id: string
  academic_year_id: string
  name: string
  grade_level: number
  homeroom_teacher_id?: string
}): Promise<Class> {
  const { data: created, error } = await supabase
    .from('classes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(data as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
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

  if (error) throw new Error(error.message)
  return updated as Class
}

/**
 * Hapus kelas berdasarkan id.
 */
export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

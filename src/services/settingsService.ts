import type {
  Profile,
  School,
  AcademicYear,
  GradeScale,
} from '@/types/database.types'
import { supabase } from './supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function throwOnError(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback)
}

// shortcut: Supabase typed-client infers `never` for update/insert when Views is Record<string,never>;
// casting via `unknown` bypasses the inference without weakening runtime safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  throwOnError(error, 'Gagal memuat profil')
  return data!
}

export async function updateProfile(
  userId: string,
  data: { full_name?: string; avatar_url?: string }
): Promise<Profile> {
  const { data: updated, error } = await db
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single()
  throwOnError(error, 'Gagal memperbarui profil')
  return updated!
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  throwOnError(error, 'Gagal memperbarui kata sandi')
}

// ─── School ───────────────────────────────────────────────────────────────────

export async function getSchool(schoolId: string): Promise<School> {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single()
  throwOnError(error, 'Gagal memuat data sekolah')
  return data!
}

export async function updateSchool(
  schoolId: string,
  data: { name?: string; address?: string; principal_name?: string }
): Promise<School> {
  const { data: updated, error } = await db
    .from('schools')
    .update(data)
    .eq('id', schoolId)
    .select()
    .single()
  throwOnError(error, 'Gagal memperbarui data sekolah')
  return updated!
}

// ─── Academic Years ───────────────────────────────────────────────────────────

export async function getAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: false })
  throwOnError(error, 'Gagal memuat tahun ajaran')
  return data ?? []
}

export async function createAcademicYear(payload: {
  school_id: string
  name: string
}): Promise<AcademicYear> {
  const { data, error } = await db
    .from('academic_years')
    .insert(payload)
    .select()
    .single()
  throwOnError(error, 'Gagal membuat tahun ajaran')
  return data!
}

export async function setActiveAcademicYear(
  schoolId: string,
  academicYearId: string
): Promise<void> {
  // Nonaktifkan semua tahun ajaran sekolah ini, lalu aktifkan yang dipilih
  const { error: deactivateError } = await db
    .from('academic_years')
    .update({ is_active: false })
    .eq('school_id', schoolId)
  throwOnError(deactivateError, 'Gagal menonaktifkan tahun ajaran')

  const { error: activateError } = await db
    .from('academic_years')
    .update({ is_active: true })
    .eq('id', academicYearId)
  throwOnError(activateError, 'Gagal mengaktifkan tahun ajaran')
}

// ─── Grade Scales ─────────────────────────────────────────────────────────────

export async function getGradeScales(schoolId: string): Promise<GradeScale[]> {
  const { data, error } = await supabase
    .from('grade_scales')
    .select('*')
    .eq('school_id', schoolId)
    .order('min_score', { ascending: false })
  throwOnError(error, 'Gagal memuat skala nilai')
  return data ?? []
}

export async function saveGradeScales(
  schoolId: string,
  scales: { min_score: number; max_score: number; letter: string }[]
): Promise<void> {
  // Hapus semua skala lama, lalu sisipkan yang baru
  const { error: deleteError } = await supabase
    .from('grade_scales')
    .delete()
    .eq('school_id', schoolId)
  throwOnError(deleteError, 'Gagal menghapus skala nilai lama')

  if (scales.length === 0) return

  const { error: insertError } = await db
    .from('grade_scales')
    .insert(scales.map((s: typeof scales[number]) => ({ ...s, school_id: schoolId })))
  throwOnError(insertError, 'Gagal menyimpan skala nilai')
}

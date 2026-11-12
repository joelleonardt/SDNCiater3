import type {
  Profile,
  School,
  AcademicYear,
  Semester,
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

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png']
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return 'Format foto harus JPG atau PNG'
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Ukuran foto maksimal 2 MB'
  }
  return null
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const validationError = validateAvatarFile(file)
  if (validationError) throw new Error(validationError)

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const filePath = `${userId}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true, contentType: file.type })
  throwOnError(uploadError, 'Gagal mengunggah foto profil')

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return data.publicUrl
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

// ─── Academic Years & Semesters ───────────────────────────────────────────────

export async function getAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: false })
  throwOnError(error, 'Gagal memuat tahun ajaran')
  return data ?? []
}

export async function getSemestersByAcademicYear(academicYearId: string): Promise<Semester[]> {
  const { data, error } = await supabase
    .from('semesters')
    .select('*')
    .eq('academic_year_id', academicYearId)
    .order('name', { ascending: true })
  throwOnError(error, 'Gagal memuat daftar semester')
  return (data ?? []) as Semester[]
}

export async function ensureSemestersForAcademicYear(academicYearId: string): Promise<Semester[]> {
  const { error } = await db
    .from('semesters')
    .upsert(
      [
        { academic_year_id: academicYearId, name: 'Ganjil' },
        { academic_year_id: academicYearId, name: 'Genap' },
      ],
      { onConflict: 'academic_year_id,name' }
    )
  throwOnError(error, 'Gagal membuat semester Ganjil dan Genap')
  return getSemestersByAcademicYear(academicYearId)
}

export async function getActiveAcademicContext(schoolId: string): Promise<{
  academicYear: AcademicYear | null
  semester: Semester | null
}> {
  const { data: activeYear } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle()

  if (!activeYear) {
    return { academicYear: null, semester: null }
  }

  const semesters = await getSemestersByAcademicYear((activeYear as AcademicYear).id)
  return {
    academicYear: activeYear as AcademicYear,
    semester: semesters[0] ?? null,
  }
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
): Promise<{ academicYear: AcademicYear; semesters: Semester[] }> {
  // Nonaktifkan semua tahun ajaran sekolah ini, lalu aktifkan yang dipilih
  const { error: deactivateError } = await db
    .from('academic_years')
    .update({ is_active: false })
    .eq('school_id', schoolId)
  throwOnError(deactivateError, 'Gagal menonaktifkan tahun ajaran')

  const { data: activated, error: activateError } = await db
    .from('academic_years')
    .update({ is_active: true })
    .eq('id', academicYearId)
    .select()
    .single()
  throwOnError(activateError, 'Gagal mengaktifkan tahun ajaran')

  // Requirement 13.5: otomatis buat semester Ganjil & Genap jika belum ada
  const semesters = await ensureSemestersForAcademicYear(academicYearId)

  return { academicYear: activated as AcademicYear, semesters }
}

// ─── Grade Scales ─────────────────────────────────────────────────────────────

/**
 * Validasi bahwa daftar rentang skala nilai mencakup tepat setiap bilangan bulat 0..100
 * tanpa celah (gap) dan tanpa tumpang tindih (overlap).
 * Requirements: 13.7
 */
export function validateGradeScales(
  scales: { min_score: number; max_score: number; letter: string }[]
): string | null {
  if (scales.length === 0) {
    return 'Skala nilai tidak boleh kosong (harus mencakup rentang 0–100).'
  }

  for (const s of scales) {
    if (!Number.isInteger(s.min_score) || !Number.isInteger(s.max_score)) {
      return 'Nilai minimum dan maksimum harus berupa bilangan bulat.'
    }
    if (s.min_score < 0 || s.max_score > 100) {
      return 'Nilai harus berada dalam rentang 0 hingga 100.'
    }
    if (s.min_score > s.max_score) {
      return `Nilai minimum (${s.min_score}) tidak boleh lebih besar dari nilai maksimum (${s.max_score}).`
    }
  }

  const sorted = [...scales].sort((a, b) => a.min_score - b.min_score)
  if (sorted[0].min_score !== 0) {
    return 'Rentang skala nilai harus dimulai dari 0.'
  }
  if (sorted[sorted.length - 1].max_score !== 100) {
    return 'Rentang skala nilai harus berakhir di 100.'
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (curr.min_score <= prev.max_score) {
      return `Rentang skala nilai tumpang tindih antara ${prev.min_score}–${prev.max_score} dan ${curr.min_score}–${curr.max_score}.`
    }
    if (curr.min_score !== prev.max_score + 1) {
      return `Terdapat celah nilai antara ${prev.max_score} dan ${curr.min_score}. Rentang harus berkesinambungan dari 0 hingga 100.`
    }
  }

  return null
}

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
  const validationError = validateGradeScales(scales)
  if (validationError) {
    throw new Error(validationError)
  }

  // Hapus semua skala lama, lalu sisipkan yang baru
  const { error: deleteError } = await supabase
    .from('grade_scales')
    .delete()
    .eq('school_id', schoolId)
  throwOnError(deleteError, 'Gagal menghapus skala nilai lama')

  const { error: insertError } = await db
    .from('grade_scales')
    .insert(scales.map((s: typeof scales[number]) => ({ ...s, school_id: schoolId })))
  throwOnError(insertError, 'Gagal menyimpan skala nilai')
}

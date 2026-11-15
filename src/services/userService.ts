import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { getStoredRoleRequests, setStoredRoleRequest } from '@/services/authService'
import type { Profile } from '@/types/database.types'

export type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

export interface CreateUserInput {
  school_id: string
  full_name: string
  email: string
  password: string
  role: Role
}

// Client sekunder tanpa persistence untuk membuat akun baru tanpa mendepak sesi admin saat ini
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isolatedAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

// shortcut: Supabase typed-client infers `never` for update/insert when Views is Record<string,never>;
// casting via `any` bypasses the inference without weakening runtime safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/** Menentukan apakah akun masih menunggu verifikasi Staf Admin (akun baru tanpa school_id atau permohonan ubah peran). */
export function isUserPendingVerification(
  user: Pick<Profile, 'school_id' | 'role' | 'requested_role' | 'is_active'>
): boolean {
  if (user.is_active === false) return false
  if (!user.school_id) return true
  return Boolean(user.requested_role && user.requested_role !== user.role)
}

async function updateProfileWithFallback(
  userId: string,
  primaryPatch: Record<string, unknown>,
  fallbackPatch: Record<string, unknown>
): Promise<Profile> {
  const { data, error } = await db
    .from('profiles')
    .update(primaryPatch)
    .eq('id', userId)
    .select()
    .single()

  if (!error && data) {
    return { ...(data as Profile), requested_role: null }
  }

  // Fallback jika kolom requested_role belum dimigrasi di database remote
  const { data: fallbackData, error: fallbackError } = await db
    .from('profiles')
    .update(fallbackPatch)
    .eq('id', userId)
    .select()
    .single()

  if (fallbackError) throw new Error(fallbackError.message)
  return { ...(fallbackData as Profile), requested_role: null }
}

/** Ambil semua pengguna milik sekolah beserta pendaftar baru yang belum terhubung (school_id IS NULL). */
export async function getUsers(schoolId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`school_id.eq.${schoolId},school_id.is.null`)
    .not('is_active', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  const storedRequests = getStoredRoleRequests()
  return ((data ?? []) as Profile[])
    .filter((u) => Boolean(u.school_id) || u.is_active !== false)
    .map((u) => {
      const cachedReq = storedRequests[u.id]
      const fallbackReq =
        cachedReq && (!u.school_id || cachedReq !== u.role) ? cachedReq : null
      return {
        ...u,
        requested_role: u.requested_role ?? fallbackReq ?? null,
      }
    })
}

/** Buat pengguna baru langsung dari antarmuka (Req 12.3, 12.4, 12.5). */
export async function createUser(input: CreateUserInput): Promise<Profile> {
  const email = input.email.trim().toLowerCase()

  // 1. Cek duplikasi email sebelum mendaftar (Req 12.5)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    throw new Error('Email sudah terdaftar oleh pengguna lain.')
  }

  // 2. Buat akun di Supabase Auth via isolated client
  const { data: authData, error: authError } = await isolatedAuthClient.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name.trim(),
        role: input.role,
        requested_role: input.role,
        school_id: input.school_id,
      },
    },
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('unique') || msg.includes('exists')) {
      throw new Error('Email sudah terdaftar oleh pengguna lain.')
    }
    throw new Error(authError.message)
  }

  const userId = authData.user?.id
  if (!userId) {
    throw new Error('Gagal membuat akun pengguna.')
  }

  // 3. Upsert ke profiles agar akun langsung aktif, terhubung ke sekolah, dan tanpa pending request
  const baseProfileRow = {
    id: userId,
    school_id: input.school_id,
    full_name: input.full_name.trim(),
    email,
    role: input.role,
    is_active: true,
  }

  const { data: newProfile, error: profileError } = await db
    .from('profiles')
    .upsert({ ...baseProfileRow, requested_role: null })
    .select()
    .single()

  if (!profileError && newProfile) {
    return { ...(newProfile as Profile), requested_role: null }
  }

  const { data: fallbackProfile, error: fallbackProfileError } = await db
    .from('profiles')
    .upsert(baseProfileRow)
    .select()
    .single()

  if (!fallbackProfileError && fallbackProfile) {
    return { ...(fallbackProfile as Profile), requested_role: null }
  }

  // Jika upsert gagal karena RLS trigger yang menanganinya, coba fetch profil hasil trigger
  const { data: fetched, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (fetchError || !fetched) {
    throw new Error(fallbackProfileError?.message ?? profileError?.message ?? 'Gagal menyimpan profil pengguna.')
  }
  return fetched
}

/** Verifikasi akun baru (menghubungkan ke sekolah & menetapkan peran) maupun menyetujui perubahan peran. */
export async function verifyUserAccount(
  userId: string,
  schoolId: string,
  approvedRole: Role
): Promise<Profile> {
  setStoredRoleRequest(userId, null)
  return updateProfileWithFallback(
    userId,
    { school_id: schoolId, role: approvedRole, requested_role: null, is_active: true },
    { school_id: schoolId, role: approvedRole, is_active: true }
  )
}

/** Tolak verifikasi akun baru (menonaktifkan akun belum terhubung) atau tolak permohonan ubah peran. */
export async function rejectUserVerification(
  userId: string,
  isNewUnlinkedAccount: boolean
): Promise<Profile> {
  setStoredRoleRequest(userId, null)
  if (isNewUnlinkedAccount) {
    return updateProfileWithFallback(
      userId,
      { requested_role: null, is_active: false },
      { is_active: false }
    )
  }
  return rejectUserRoleRequest(userId)
}

/** Perbarui peran pengguna (sekaligus bersihkan permohonan peran jika ada). Requirements: 12.6, 12.7 */
export async function updateUserRole(userId: string, role: Role): Promise<Profile> {
  setStoredRoleRequest(userId, null)
  return updateProfileWithFallback(userId, { role, requested_role: null }, { role })
}

/** Tolak permohonan perubahan peran pengguna (reset requested_role ke null). */
export async function rejectUserRoleRequest(userId: string): Promise<Profile> {
  setStoredRoleRequest(userId, null)

  const { data, error } = await db
    .from('profiles')
    .update({ requested_role: null })
    .eq('id', userId)
    .select()
    .single()

  if (!error && data) {
    return { ...(data as Profile), requested_role: null }
  }

  const { data: current, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (fetchError || !current) {
    throw new Error(error?.message ?? 'Gagal menolak permohonan peran')
  }
  return { ...(current as Profile), requested_role: null }
}

/** Aktifkan atau nonaktifkan pengguna. Requirements: 12.8 */
export async function toggleUserActive(userId: string, isActive: boolean): Promise<Profile> {
  const { data, error } = await db
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

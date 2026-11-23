import type { AuthResponse, Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database.types'
import { supabase } from './supabase'

// ─── Error type ──────────────────────────────────────────────────────────────

export interface ServiceError {
  code: string
  message: string
  userMessage: string // Pesan dalam Bahasa Indonesia
}

function makeServiceError(code: string, message: string, userMessage: string): ServiceError {
  return { code, message, userMessage }
}

// ─── authService ──────────────────────────────────────────────────────────────

/**
 * Masuk menggunakan email dan kata sandi.
 * Melempar ServiceError jika kredensial salah atau terjadi error lain.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  const result = await supabase.auth.signInWithPassword({ email, password })

  if (result.error) {
    const isCredentialError =
      result.error.message.toLowerCase().includes('invalid login credentials') ||
      result.error.message.toLowerCase().includes('invalid email or password') ||
      result.error.message.toLowerCase().includes('email not confirmed') ||
      result.error.status === 400

    throw makeServiceError(
      result.error.name ?? 'auth/sign-in-error',
      result.error.message,
      isCredentialError
        ? 'Email atau kata sandi salah. Silakan coba lagi.'
        : 'Terjadi kesalahan. Silakan coba lagi.'
    )
  }

  return result
}

export const DEFAULT_SCHOOL_ID = '11111111-1111-1111-1111-111111111111'
export const ROLE_REQUESTS_STORAGE_KEY = 'sekolah_admin_role_requests'

export type UserRole = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

export function getStoredRoleRequests(): Record<string, UserRole> {
  try {
    const raw = localStorage.getItem(ROLE_REQUESTS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, UserRole>) : {}
  } catch {
    return {}
  }
}

export function setStoredRoleRequest(userId: string, role: UserRole | null): void {
  try {
    const current = getStoredRoleRequests()
    if (role) {
      current[userId] = role
    } else {
      delete current[userId]
    }
    localStorage.setItem(ROLE_REQUESTS_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Daftar akun baru secara mandiri dari halaman Login.
 * Demi keamanan, akun baru dimulai sebagai 'Guru' (kecuali bootstrap admin pertama).
 * Jika pengguna memilih peran 'Staf_Admin' atau 'Kepala_Sekolah', pilihan tersebut
 * disimpan sebagai permohonan perubahan peran (requested_role) yang menunggu
 * verifikasi di Dashboard Admin.
 */
export async function signUp(
  fullName: string,
  email: string,
  password: string,
  desiredRole: UserRole = 'Guru'
): Promise<AuthResponse> {
  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = fullName.trim()

  // 1. Prioritaskan RPC SECURITY DEFINER register_user_no_email agar registrasi tidak mengirim email
  //    dan verifikasi akun dilakukan 100% dari Dashboard Admin (bebas dari email rate limit).
  const { data: rpcUserId, error: rpcError } = await db.rpc('register_user_no_email', {
    p_email: normalizedEmail,
    p_password: password,
    p_full_name: trimmedName,
    p_requested_role: desiredRole,
  })

  if (!rpcError && typeof rpcUserId === 'string' && rpcUserId.length > 0) {
    setStoredRoleRequest(rpcUserId, desiredRole)
    const syntheticUser = {
      id: rpcUserId,
      email: normalizedEmail,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {
        full_name: trimmedName,
        role: 'Guru',
        requested_role: desiredRole,
      },
      created_at: new Date().toISOString(),
    } as unknown as User

    return {
      data: {
        user: syntheticUser,
        session: null,
      },
      error: null,
    }
  }

  if (rpcError) {
    const rpcMsg = (rpcError.message ?? '').toLowerCase()
    const isMissingRpc =
      rpcError.code === 'PGRST202' ||
      rpcError.code === '42883' ||
      rpcMsg.includes('could not find the function') ||
      rpcMsg.includes('does not exist')

    if (!isMissingRpc) {
      const isDuplicate =
        rpcMsg.includes('sudah terdaftar') ||
        rpcMsg.includes('already registered') ||
        rpcMsg.includes('unique') ||
        rpcMsg.includes('exists')

      throw makeServiceError(
        'auth/sign-up-error',
        rpcError.message,
        isDuplicate
          ? 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.'
          : rpcError.message
      )
    }
  }

  // 2. Fallback ke Supabase Auth signUp jika fungsi RPC belum dimigrasikan di database
  const result = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: trimmedName,
        role: 'Guru',
        requested_role: desiredRole,
      },
    },
  })

  if (result.error) {
    const msg = result.error.message.toLowerCase()
    const isDuplicate =
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      msg.includes('user already exists')
    const isRateLimit = msg.includes('rate limit') || result.error.status === 429

    throw makeServiceError(
      result.error.name ?? 'auth/sign-up-error',
      result.error.message,
      isDuplicate
        ? 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.'
        : isRateLimit
          ? 'Batas pengiriman email Supabase terlampaui. Jalankan skrip terbaru supabase/sync_existing_db.sql di SQL Editor Supabase atau matikan "Confirm email" di Supabase Dashboard agar verifikasi cukup melalui Dashboard Admin.'
          : 'Gagal membuat akun baru. Silakan coba lagi.'
    )
  }

  const userId = result.data.user?.id
  if (userId) {
    setStoredRoleRequest(userId, desiredRole)
  }

  // Jika sesi langsung aktif, catat permohonan peran tanpa auto-linking ke sekolah
  if (userId && result.data.session) {
    await requestRoleChange(userId, desiredRole).catch(() => undefined)
  }

  return result
}

/**
 * Ajukan permohonan perubahan peran (Guru / Kepala_Sekolah / Staf_Admin)
 * untuk diverifikasi oleh Staf_Admin melalui Dashboard Admin / Halaman Pengguna.
 */
export async function requestRoleChange(
  userId: string,
  requestedRole: UserRole | null
): Promise<void> {
  setStoredRoleRequest(userId, requestedRole)

  await supabase.auth
    .updateUser({
      data: { requested_role: requestedRole },
    })
    .catch(() => undefined)

  // Coba simpan ke kolom requested_role pada tabel profiles jika kolom sudah tersedia
  await db
    .from('profiles')
    .update({ requested_role: requestedRole })
    .eq('id', userId)
    .then(() => undefined)
    .catch(() => undefined)
}

/**
 * Hubungkan profil pengguna yang belum memiliki school_id ke sekolah utama,
 * serta dukung inisialisasi admin pertama jika sekolah belum memiliki Staf_Admin.
 */
export async function linkProfileToSchool(
  userId: string,
  role?: UserRole
): Promise<Profile> {
  // 1. Coba panggil RPC SECURITY DEFINER bootstrap_school_and_profile jika sudah terpasang di database
  const { data: rpcData, error: rpcError } = await db.rpc(
    'bootstrap_school_and_profile',
    { p_requested_role: role ?? null }
  )

  if (!rpcError && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
    if (row && typeof row === 'object' && 'id' in row) {
      return row as Profile
    }
  }

  // 2. Fallback langsung via tabel schools & profiles
  let targetSchoolId = DEFAULT_SCHOOL_ID

  const { data: existingSchool } = await db
    .from('schools')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingSchool?.id) {
    targetSchoolId = existingSchool.id as string
  } else {
    // Coba buat sekolah default jika tabel schools masih kosong dan policy mengizinkan
    const { data: createdSchool } = await db
      .from('schools')
      .upsert({
        id: DEFAULT_SCHOOL_ID,
        name: 'SDN 1 Nusantara',
        address: 'Jl. Pendidikan No. 1, Jakarta Pusat',
        principal_name: 'Drs. Hendra Wijaya, M.Pd.',
      })
      .select('id')
      .maybeSingle()

    if (createdSchool?.id) {
      targetSchoolId = createdSchool.id as string
    }
  }

  const updatePayload: Record<string, unknown> = {
    school_id: targetSchoolId,
  }
  if (role) {
    updatePayload.role = role
  }

  const { data, error } = await db
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select('*')
    .single()

  if (error || !data) {
    const detail = error?.message ? ` (${error.message})` : ''
    throw makeServiceError(
      error?.code ?? 'auth/link-school-error',
      error?.message ?? 'Failed to link profile to school',
      `Gagal menghubungkan akun ke sekolah${detail}. Jalankan skrip inisialisasi 1x di Supabase SQL Editor.`
    )
  }

  return data as Profile
}

/**
 * Keluar dari sesi saat ini.
 * Melempar ServiceError jika sign-out gagal.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw makeServiceError(
      error.name ?? 'auth/sign-out-error',
      error.message,
      'Terjadi kesalahan saat keluar. Silakan coba lagi.'
    )
  }
}

/**
 * Kirim email reset kata sandi ke alamat yang diberikan.
 * Melempar ServiceError jika pengiriman gagal.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  if (error) {
    throw makeServiceError(
      error.name ?? 'auth/reset-password-error',
      error.message,
      'Terjadi kesalahan saat mengirim email reset. Silakan coba lagi.'
    )
  }
}

/**
 * Perbarui kata sandi pengguna yang sedang login.
 * Harus dipanggil setelah user mengklik link reset dari email.
 * Melempar ServiceError jika pembaruan gagal.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    throw makeServiceError(
      error.name ?? 'auth/update-password-error',
      error.message,
      'Terjadi kesalahan saat memperbarui kata sandi. Silakan coba lagi.'
    )
  }
}

/**
 * Ambil profil pengguna berdasarkan userId.
 * Melempar ServiceError jika profil tidak ditemukan atau query gagal.
 */
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    throw makeServiceError(
      error.code ?? 'auth/get-profile-error',
      error.message,
      'Terjadi kesalahan saat memuat profil. Silakan coba lagi.'
    )
  }

  if (!data) {
    throw makeServiceError(
      'auth/profile-not-found',
      `Profile not found for userId: ${userId}`,
      'Profil pengguna tidak ditemukan. Silakan hubungi administrator.'
    )
  }

  let profile = data as Profile

  if (profile.is_active === false) {
    await supabase.auth.signOut().catch(() => undefined)
    throw makeServiceError(
      'auth/account-disabled',
      `Profile is inactive for userId: ${userId}`,
      'Akun Anda telah dinonaktifkan oleh administrator sekolah.'
    )
  }

  const storedRequests = getStoredRoleRequests()
  const cachedReq = storedRequests[userId]
  if (!profile.requested_role && cachedReq && (!profile.school_id || cachedReq !== profile.role)) {
    profile = { ...profile, requested_role: cachedReq }
  }

  return profile
}

/**
 * Ambil sesi yang sedang aktif (jika ada).
 * Berguna saat inisialisasi awal untuk restore sesi dari localStorage.
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw makeServiceError(
      error.name ?? 'auth/get-session-error',
      error.message,
      'Terjadi kesalahan saat memulihkan sesi. Silakan coba lagi.'
    )
  }

  return data.session
}

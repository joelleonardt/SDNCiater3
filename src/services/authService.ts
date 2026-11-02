import type { AuthResponse, Session } from '@supabase/supabase-js'
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

  return data
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

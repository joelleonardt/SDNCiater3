import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database.types'
import { supabase } from '@/services/supabase'
import { getProfile } from '@/services/authService'

interface AuthState {
  session: Session | null
  profile: Profile | null
  /**
   * Bernilai true ketika sesi berakhir karena token refresh gagal (kadaluarsa),
   * bukan karena pengguna sengaja logout.
   * Requirements: 2.8
   */
  sessionExpired: boolean

  /** Simpan sesi dan profil ke store */
  setSession: (session: Session | null, profile: Profile | null) => void

  /** Hapus sesi dan profil dari store (logout / sesi kadaluarsa) */
  clearSession: () => void

  /** Reset flag sessionExpired setelah redirect ke halaman login */
  resetSessionExpired: () => void

  /**
   * Inisialisasi auth listener.
   * Panggil sekali saat aplikasi mount (di providers.tsx).
   * Mengembalikan fungsi unsubscribe yang perlu dipanggil saat unmount.
   */
  initializeAuth: () => () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  sessionExpired: false,

  setSession: (session, profile) => set({ session, profile }),

  clearSession: () => set({ session: null, profile: null, sessionExpired: false }),

  resetSessionExpired: () => set({ sessionExpired: false }),

  initializeAuth: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || session === null) {
        // Requirement 2.8: Deteksi apakah SIGNED_OUT disebabkan sesi kadaluarsa.
        // Supabase JS menembak event SIGNED_OUT dengan session === null ketika
        // token refresh gagal (access token + refresh token keduanya sudah expired).
        // Jika sebelumnya ada sesi aktif di store, ini adalah expiry otomatis,
        // bukan logout manual (logout manual memanggil clearSession() lebih dahulu).
        const hadActiveSession = get().session !== null
        const isManualLogout = !hadActiveSession
        set({
          session: null,
          profile: null,
          sessionExpired: hadActiveSession && !isManualLogout,
        })
        return
      }

      // Untuk SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, dsb.
      if (session) {
        try {
          const profile = await getProfile(session.user.id)
          set({ session, profile, sessionExpired: false })
        } catch {
          // Profil tidak dapat dimuat — simpan sesi saja tanpa profil
          // agar ProtectedRoute tetap berfungsi; profil null akan ditangani UI
          set({ session, profile: null, sessionExpired: false })
        }
      }
    })

    // Kembalikan fungsi cleanup untuk dipanggil saat unmount
    return () => {
      subscription.unsubscribe()
    }
  },
}))

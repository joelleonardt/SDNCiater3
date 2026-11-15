import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database.types'
import { supabase } from '@/services/supabase'
import { getProfile } from '@/services/authService'

interface AuthState {
  session: Session | null
  profile: Profile | null
  /** True saat proses initial auth / pengambilan profil sedang berlangsung */
  profileLoading: boolean
  /** Pesan error jika pengambilan profil gagal (mis. RLS 500 atau profil belum dibuat) */
  profileError: string | null
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

  /** Muat ulang profil pengguna saat ini dari Supabase */
  refreshProfile: () => Promise<Profile | null>

  /**
   * Inisialisasi auth listener.
   * Panggil sekali saat aplikasi mount (di providers.tsx).
   * Mengembalikan fungsi unsubscribe yang perlu dipanggil saat unmount.
   */
  initializeAuth: () => () => void
}

function extractProfileError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code
      ? String((err as { code: unknown }).code)
      : ''
  const rawMsg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : ''
  const userMsg =
    err && typeof err === 'object' && 'userMessage' in err
      ? String((err as { userMessage: unknown }).userMessage)
      : 'Gagal memuat profil pengguna.'
  const detail = [code ? `[${code}]` : '', rawMsg && rawMsg !== userMsg ? rawMsg : '']
    .filter(Boolean)
    .join(' ')
  return detail ? `${userMsg} (${detail})` : userMsg
}

let inflightProfileRequest: { userId: string; promise: Promise<Profile> } | null = null

function fetchProfileDeduped(userId: string): Promise<Profile> {
  if (inflightProfileRequest && inflightProfileRequest.userId === userId) {
    return inflightProfileRequest.promise
  }
  const promise = getProfile(userId).finally(() => {
    if (inflightProfileRequest?.promise === promise) {
      inflightProfileRequest = null
    }
  })
  inflightProfileRequest = { userId, promise }
  return promise
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  profileLoading: true,
  profileError: null,
  sessionExpired: false,

  setSession: (session, profile) =>
    set({ session, profile, profileLoading: false, profileError: null }),

  clearSession: () =>
    set({
      session: null,
      profile: null,
      profileLoading: false,
      profileError: null,
      sessionExpired: false,
    }),

  resetSessionExpired: () => set({ sessionExpired: false }),

  refreshProfile: async () => {
    const currentSession = get().session
    if (!currentSession?.user?.id) {
      set({ profileLoading: false })
      return null
    }
    set({ profileLoading: true, profileError: null })
    try {
      const profile = await fetchProfileDeduped(currentSession.user.id)
      set({ profile, profileLoading: false, profileError: null })
      return profile
    } catch (err) {
      set({
        profile: null,
        profileLoading: false,
        profileError: extractProfileError(err),
      })
      return null
    }
  },

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
          profileLoading: false,
          profileError: null,
          sessionExpired: hadActiveSession && !isManualLogout,
        })
        return
      }

      // Untuk SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED, dsb.
      if (session) {
        const existingProfile = get().profile
        if (existingProfile?.id === session.user.id && event === 'TOKEN_REFRESHED') {
          set({ session, profileLoading: false, sessionExpired: false })
          return
        }

        set({ session, profileLoading: true, profileError: null, sessionExpired: false })
        try {
          const profile = await fetchProfileDeduped(session.user.id)
          set({ session, profile, profileLoading: false, profileError: null, sessionExpired: false })
        } catch (err) {
          // Profil tidak dapat dimuat — simpan error agar UI dapat menampilkan diagnostik yang jelas
          set({
            session,
            profile: null,
            profileLoading: false,
            profileError: extractProfileError(err),
            sessionExpired: false,
          })
        }
      }
    })

    // Kembalikan fungsi cleanup untuk dipanggil saat unmount
    return () => {
      subscription.unsubscribe()
    }
  },
}))

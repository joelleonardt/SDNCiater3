import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { getActiveAcademicContext } from '@/services/settingsService'

interface AppProvidersProps {
  children: React.ReactNode
}

/**
 * ThemeProvider
 *
 * Menerapkan class 'dark' / 'light' ke document.documentElement berdasarkan
 * nilai `theme` di appStore. Mendukung tiga mode:
 * - 'light'  → hapus class 'dark'
 * - 'dark'   → tambah class 'dark'
 * - 'system' → ikuti prefers-color-scheme OS, update otomatis saat berubah
 *
 * Requirements: 14.7, 14.8
 */
function ThemeProvider() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const applySystem = (e: MediaQueryListEvent | MediaQueryList) => {
        root.classList.toggle('dark', e.matches)
      }

      // Terapkan segera
      applySystem(mediaQuery)

      // Update saat OS preference berubah
      mediaQuery.addEventListener('change', applySystem)
      return () => mediaQuery.removeEventListener('change', applySystem)
    }

    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return null
}

/**
 * AppProviders
 *
 * Global providers untuk aplikasi:
 * - Inisialisasi auth listener via Supabase onAuthStateChange
 * - Sinkronisasi Tahun_Ajaran & Semester aktif ke appStore saat user login
 * - ThemeProvider: mengelola dark/light/system class pada <html>
 */
export function AppProviders({ children }: AppProvidersProps) {
  const initializeAuth = useAuthStore((s) => s.initializeAuth)
  const schoolId = useAuthStore((s) => s.profile?.school_id ?? null)
  const setActiveAcademicYear = useAppStore((s) => s.setActiveAcademicYear)
  const setActiveSemester = useAppStore((s) => s.setActiveSemester)

  useEffect(() => {
    // Mulai listener auth state change dan simpan cleanup function
    const unsubscribe = initializeAuth()
    return unsubscribe
  }, [initializeAuth])

  useEffect(() => {
    if (!schoolId) {
      setActiveAcademicYear(null)
      setActiveSemester(null)
      return
    }
    let cancelled = false
    getActiveAcademicContext(schoolId)
      .then(({ academicYear, semester }) => {
        if (cancelled) return
        setActiveAcademicYear(academicYear)
        setActiveSemester(semester)
      })
      .catch(() => {
        // Biarkan null jika belum ada tahun ajaran aktif
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, setActiveAcademicYear, setActiveSemester])

  return (
    <>
      <ThemeProvider />
      {children}
    </>
  )
}

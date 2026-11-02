import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

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
 * - ThemeProvider: mengelola dark/light/system class pada <html>
 */
export function AppProviders({ children }: AppProvidersProps) {
  const initializeAuth = useAuthStore((s) => s.initializeAuth)

  useEffect(() => {
    // Mulai listener auth state change dan simpan cleanup function
    const unsubscribe = initializeAuth()
    return unsubscribe
  }, [initializeAuth])

  return (
    <>
      <ThemeProvider />
      {children}
    </>
  )
}

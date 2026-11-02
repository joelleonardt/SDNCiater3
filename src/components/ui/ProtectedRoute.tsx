import { useEffect } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

/**
 * Membungkus rute yang memerlukan sesi aktif.
 *
 * - Jika tidak ada sesi dan sesi kadaluarsa: redirect ke /login dengan pesan
 * - Jika tidak ada sesi: redirect ke /login
 * - Jika ada sesi: render children (atau Outlet jika dipakai sebagai layout route)
 *
 * Requirements: 2.5, 2.8
 */
interface ProtectedRouteProps {
  children?: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const session = useAuthStore((s) => s.session)
  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const resetSessionExpired = useAuthStore((s) => s.resetSessionExpired)
  const navigate = useNavigate()

  // Requirement 2.8: Saat sesi kadaluarsa, redirect ke /login dengan pesan Bahasa Indonesia
  useEffect(() => {
    if (!session && sessionExpired) {
      resetSessionExpired()
      navigate('/login', {
        replace: true,
        state: { message: 'Sesi Anda telah berakhir. Silakan masuk kembali.' },
      })
    }
  }, [session, sessionExpired, resetSessionExpired, navigate])

  if (!session) {
    // Jika bukan karena expiry, redirect biasa tanpa pesan
    if (!sessionExpired) {
      return <Navigate to="/login" replace />
    }
    // Tunggu useEffect di atas yang melakukan redirect dengan state
    return null
  }

  // Jika dipakai sebagai layout route (tanpa children), render Outlet
  return children ? <>{children}</> : <Outlet />
}

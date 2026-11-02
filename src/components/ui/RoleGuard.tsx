import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/database.types'

type UserRole = Profile['role']

/**
 * Membungkus rute yang memerlukan peran tertentu.
 *
 * - Jika role tidak ada di allowedRoles: redirect ke /403
 * - Jika role cocok: render children (atau Outlet jika dipakai sebagai layout route)
 *
 * Requirements: 3.6, 3.7
 */
interface RoleGuardProps {
  allowedRoles: UserRole[]
  children?: React.ReactNode
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const profile = useAuthStore((s) => s.profile)

  // Jika profil belum tersedia atau role tidak ada dalam daftar yang diizinkan
  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/403" replace />
  }

  // Jika dipakai sebagai layout route (tanpa children), render Outlet
  return children ? <>{children}</> : <Outlet />
}

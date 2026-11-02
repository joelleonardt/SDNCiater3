import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import RoleGuard from '@/components/ui/RoleGuard';
import AppShell from '@/components/ui/AppShell';
import ForbiddenPage from '../features/auth/ForbiddenPage';

// ──────────────────────────────────────────────
// Placeholder page components
// (akan diganti dengan import lazy ke fitur nyata)
// ──────────────────────────────────────────────

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex min-h-screen items-center justify-center">
    <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
  </div>
);

// Auth pages
const LoginPage = lazy(() =>
  import('../features/auth/LoginPage').catch(() => ({
    default: () => <PlaceholderPage title="Login" />,
  }))
);
const ForgotPasswordPage = lazy(() =>
  import('../features/auth/ForgotPasswordPage').catch(() => ({
    default: () => <PlaceholderPage title="Lupa Password" />,
  }))
);
const ResetPasswordPage = lazy(() =>
  import('../features/auth/ResetPasswordPage').catch(() => ({
    default: () => <PlaceholderPage title="Reset Password" />,
  }))
);

// Main pages
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').catch(() => ({
    default: () => <PlaceholderPage title="Dashboard" />,
  }))
);
const ClassesPage = lazy(() =>
  import('../features/classes/ClassesPage').catch(() => ({
    default: () => <PlaceholderPage title="Kelas" />,
  }))
);
const StudentsPage = lazy(() =>
  import('../features/students/StudentsPage').catch(() => ({
    default: () => <PlaceholderPage title="Siswa" />,
  }))
);
const StudentDetailPage = lazy(() =>
  import('../features/students/StudentDetailPage').catch(() => ({
    default: () => <PlaceholderPage title="Detail Siswa" />,
  }))
);
const AttendancePage = lazy(() =>
  import('../features/attendance/AttendancePage').catch(() => ({
    default: () => <PlaceholderPage title="Kehadiran" />,
  }))
);
const SchedulesPage = lazy(() =>
  import('../features/schedules/SchedulePage').catch(() => ({
    default: () => <PlaceholderPage title="Jadwal" />,
  }))
);
const GradesPage = lazy(() =>
  import('../features/grades/GradesPage').catch(() => ({
    default: () => <PlaceholderPage title="Nilai" />,
  }))
);
const ReportsPage = lazy(() =>
  import('../features/reports/ReportsPage').catch(() => ({
    default: () => <PlaceholderPage title="Laporan" />,
  }))
);
const UsersPage = lazy(() =>
  import('../features/users/UsersPage').catch(() => ({
    default: () => <PlaceholderPage title="Pengguna" />,
  }))
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').catch(() => ({
    default: () => <PlaceholderPage title="Pengaturan" />,
  }))
);

// Error pages are imported above (ForbiddenPage) or defined inline (NotFoundPage)

const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4">
    <h1 className="text-4xl font-bold">404</h1>
    <p className="text-muted-foreground">Halaman tidak ditemukan.</p>
  </div>
);

// ──────────────────────────────────────────────
// Authenticated layout:
// ProtectedRoute (auth guard) → AppShell (sidebar + topbar) → page children
// Requirements: 3.1, 3.3
// ──────────────────────────────────────────────

const AuthenticatedLayout = () => (
  <ProtectedRoute>
    <AppShell>
      <Outlet />
    </AppShell>
  </ProtectedRoute>
);

// ──────────────────────────────────────────────
// Suspense wrapper
// ──────────────────────────────────────────────

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full items-center justify-center">
        <span className="text-muted-foreground">Memuat...</span>
      </div>
    }
  >
    {children}
  </Suspense>
);

// ──────────────────────────────────────────────
// Route definitions
// ──────────────────────────────────────────────

export const router = createBrowserRouter([
  // Auth routes (tidak memerlukan layout AppShell)
  {
    path: '/login',
    element: (
      <PageWrapper>
        <LoginPage />
      </PageWrapper>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PageWrapper>
        <ForgotPasswordPage />
      </PageWrapper>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <PageWrapper>
        <ResetPasswordPage />
      </PageWrapper>
    ),
  },

  // Error routes
  {
    path: '/403',
    element: <ForbiddenPage />,
  },

  // Protected routes — hanya dapat diakses dengan sesi aktif
  // AuthenticatedLayout = ProtectedRoute + AppShell (Requirements: 2.5, 3.1, 3.3)
  {
    path: '/',
    element: <AuthenticatedLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },

      // ── Dashboard — semua peran ──
      {
        path: 'dashboard',
        element: (
          <PageWrapper>
            <DashboardPage />
          </PageWrapper>
        ),
      },

      // ── Kehadiran — semua peran ──
      {
        path: 'attendance',
        element: (
          <PageWrapper>
            <AttendancePage />
          </PageWrapper>
        ),
      },

      // ── Kelas — Guru & Staf_Admin saja (Requirements: 3.6) ──
      {
        path: 'classes',
        element: (
          <RoleGuard allowedRoles={['Guru', 'Staf_Admin']}>
            <PageWrapper>
              <ClassesPage />
            </PageWrapper>
          </RoleGuard>
        ),
      },

      // ── Siswa — Guru & Staf_Admin saja (Requirements: 3.6) ──
      {
        path: 'students',
        element: (
          <RoleGuard allowedRoles={['Guru', 'Staf_Admin']}>
            <PageWrapper>
              <StudentsPage />
            </PageWrapper>
          </RoleGuard>
        ),
      },
      {
        path: 'students/:id',
        element: (
          <RoleGuard allowedRoles={['Guru', 'Staf_Admin']}>
            <PageWrapper>
              <StudentDetailPage />
            </PageWrapper>
          </RoleGuard>
        ),
      },

      // ── Jadwal — semua peran ──
      {
        path: 'schedules',
        element: (
          <PageWrapper>
            <SchedulesPage />
          </PageWrapper>
        ),
      },

      // ── Nilai — semua peran ──
      {
        path: 'grades',
        element: (
          <PageWrapper>
            <GradesPage />
          </PageWrapper>
        ),
      },

      // ── Laporan — Guru & Kepala_Sekolah saja (Requirements: 3.6) ──
      {
        path: 'reports',
        element: (
          <RoleGuard allowedRoles={['Guru', 'Kepala_Sekolah']}>
            <PageWrapper>
              <ReportsPage />
            </PageWrapper>
          </RoleGuard>
        ),
      },

      // ── Pengguna — Kepala_Sekolah & Staf_Admin saja (Requirements: 12.1, 3.6) ──
      {
        path: 'users',
        element: (
          <RoleGuard allowedRoles={['Kepala_Sekolah', 'Staf_Admin']}>
            <PageWrapper>
              <UsersPage />
            </PageWrapper>
          </RoleGuard>
        ),
      },

      // ── Pengaturan — semua peran ──
      {
        path: 'settings',
        element: (
          <PageWrapper>
            <SettingsPage />
          </PageWrapper>
        ),
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

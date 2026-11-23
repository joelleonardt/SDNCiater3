import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  BarChart3,
  FileText,
  UserCog,
  Settings,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  allowedRoles: Role[]
}

/**
 * Daftar item navigasi beserta peran yang diizinkan.
 * Requirements: 3.6
 */
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Kelas',
    path: '/classes',
    icon: BookOpen,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Siswa',
    path: '/students',
    icon: GraduationCap,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Kehadiran',
    path: '/attendance',
    icon: CalendarCheck,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Jadwal',
    path: '/schedules',
    icon: CalendarDays,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Jurnal Harian',
    path: '/journals',
    icon: ClipboardList,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Nilai',
    path: '/grades',
    icon: BarChart3,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Laporan',
    path: '/reports',
    icon: FileText,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Pengguna',
    path: '/users',
    icon: UserCog,
    allowedRoles: ['Kepala_Sekolah', 'Staf_Admin'],
  },
  {
    label: 'Pengaturan',
    path: '/settings',
    icon: Settings,
    allowedRoles: ['Guru', 'Kepala_Sekolah', 'Staf_Admin'],
  },
]

/**
 * Sidebar navigasi utama.
 *
 * - Collapsible state dikontrol dari uiStore (Requirements: 3.1)
 * - Item ditampilkan bersyarat berdasarkan peran pengguna (Requirements: 3.6)
 * - Pada viewport ≥1024px default expanded; pada mobile dikendalikan AppShell
 */
export default function Sidebar() {
  const profile = useAuthStore((s) => s.profile)
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const navigate = useNavigate()
  const location = useLocation()

  const role = profile?.role as Role | undefined

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => item.allowedRoles.includes(role))
    : []

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-background transition-all duration-300',
          // On mobile the sidebar is always shown as a full-width drawer (w-64 capped to screen).
          // On desktop, respect the collapsed/expanded toggle.
          sidebarCollapsed ? 'w-16' : 'w-64 max-w-[85vw]'
        )}
        aria-label="Navigasi utama"
      >
        {/* Logo area */}
        <div
          className={cn(
            'flex h-16 items-center border-b px-4',
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {!sidebarCollapsed && (
            <button
              className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-accent"
              onClick={() => navigate('/dashboard')}
              aria-label="Ke Dashboard"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="text-base font-bold tracking-tight text-primary">
                Sekolah Admin
              </span>
            </button>
          )}
          {/* Toggle button — visible on lg+ (mobile handled by Topbar) */}
          <button
            onClick={toggleSidebar}
            className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:flex"
            aria-label={sidebarCollapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul role="list" className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/dashboard'
                  ? location.pathname === '/dashboard'
                  : location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`)

              const linkClassName = cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-4 border-primary bg-accent pl-2.5 font-semibold text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                sidebarCollapsed && 'justify-center px-2 border-l-0'
              )

              return (
                <li key={item.path}>
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path}
                          className={linkClassName}
                          aria-label={item.label}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      to={item.path}
                      className={linkClassName}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate leading-none">{item.label}</span>
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User info at bottom (when expanded) */}
        {!sidebarCollapsed && profile && (
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none">
                  {profile.full_name}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {profile.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}

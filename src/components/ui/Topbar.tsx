import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, User, LogOut, Sun, Moon, Monitor } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useAppStore, type Theme } from '@/stores/appStore'
import { signOut } from '@/services/authService'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TopbarProps {
  /** Callback untuk toggle mobile drawer */
  onMobileMenuToggle?: () => void
  className?: string
}

/**
 * Top bar yang tampil di setiap halaman terautentikasi.
 *
 * Berisi:
 * - Tombol hamburger (toggle sidebar di desktop, buka drawer di mobile)
 * - Logo / nama aplikasi
 * - Global search field
 * - Ikon notifikasi
 * - Theme toggle (Sun / Moon / Monitor)
 * - Profile dropdown ("Profil Saya", "Keluar")
 *
 * Requirements: 3.3, 3.4, 14.7, 14.8
 */
export default function Topbar({ onMobileMenuToggle, className }: TopbarProps) {
  const profile = useAuthStore((s) => s.profile)
  const clearSession = useAuthStore((s) => s.clearSession)
  const pushToast = useUIStore((s) => s.pushToast)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const navigate = useNavigate()

  const themeOptions: { value: Theme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Mode terang', Icon: Sun },
    { value: 'dark', label: 'Mode gelap', Icon: Moon },
    { value: 'system', label: 'Ikuti sistem', Icon: Monitor },
  ]

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join('')
    : '?'

  async function handleSignOut() {
    try {
      clearSession() // optimistic clear sebelum request
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      pushToast({
        title: 'Gagal keluar',
        description: 'Terjadi kesalahan saat keluar. Silakan coba lagi.',
        variant: 'destructive',
      })
    }
  }

  function handleMobileToggle() {
    if (onMobileMenuToggle) {
      onMobileMenuToggle()
    } else {
      // fallback: toggle via uiStore (desktop collapse)
      toggleSidebar()
    }
  }

  return (
    <header
      className={cn(
        'flex h-16 items-center gap-3 border-b bg-background px-4 lg:px-6',
        className
      )}
      role="banner"
    >
      {/* Hamburger button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMobileToggle}
        aria-label="Toggle menu navigasi"
        className="shrink-0"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo / app name — shown on mobile when sidebar is hidden */}
      <span className="text-base font-bold text-primary lg:hidden">
        Sekolah Admin
      </span>

      {/* Global search */}
      <div className="relative ml-auto flex-1 lg:ml-0 lg:max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Cari..."
          className="w-full pl-9"
          aria-label="Pencarian global"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Tema saat ini: ${
                theme === 'light' ? 'terang' : theme === 'dark' ? 'gelap' : 'sistem'
              }. Klik untuk mengubah tema`}
            >
              <ThemeIcon className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {themeOptions.map(({ value, label, Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className={cn('cursor-pointer gap-2', theme === value && 'font-semibold')}
                aria-current={theme === value ? 'true' : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifikasi"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {/* Badge placeholder — akan diisi ketika fitur notifikasi diimplementasikan */}
        </Button>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0"
              aria-label="Menu profil pengguna"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={profile?.avatar_url ?? undefined}
                  alt={profile?.full_name ?? 'Foto profil'}
                />
                <AvatarFallback className="text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            {/* Profile info header */}
            {profile && (
              <>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">
                    {profile.full_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.role.replace('_', ' ')}
                  </p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Requirement 3.4: "Profil Saya" */}
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="cursor-pointer gap-2"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Profil Saya</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Requirement 3.4: "Keluar" */}
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, User, LogOut, Sun, Moon, Monitor, ShieldCheck, Clock, Check } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useAppStore, type Theme } from '@/stores/appStore'
import { requestRoleChange, signOut, type UserRole } from '@/services/authService'
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NOTIFICATIONS_UPDATED_EVENT,
} from '@/services/journalService'
import type { AppNotification } from '@/types/database.types'
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
  const session = useAuthStore((s) => s.session)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const clearSession = useAuthStore((s) => s.clearSession)
  const pushToast = useUIStore((s) => s.pushToast)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const navigate = useNavigate()
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])

  const loadNotifications = React.useCallback(async () => {
    const userId = profile?.id ?? session?.user?.id
    if (!userId) {
      setNotifications([])
      return
    }
    try {
      const items = await getMyNotifications(userId, 10)
      setNotifications(items)
    } catch {
      // Abaikan kegagalan sementara pada lonceng topbar
    }
  }, [profile?.id, session?.user?.id])

  React.useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  React.useEffect(() => {
    function handleRefresh() {
      void loadNotifications()
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleRefresh)
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleRefresh)
  }, [loadNotifications])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleNotificationClick(notif: AppNotification) {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      )
    }
    navigate('/journals')
  }

  async function handleMarkAllRead() {
    const userId = profile?.id ?? session?.user?.id
    if (!userId) return
    await markAllNotificationsAsRead(userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  async function handleRequestRoleChange(nextRole: UserRole) {
    const userId = profile?.id ?? session?.user?.id
    if (!userId) return
    if (profile?.role === nextRole) return

    try {
      await requestRoleChange(userId, nextRole)
      await refreshProfile()
      pushToast({
        title: 'Permohonan dikirim',
        description: `Permintaan perubahan peran ke ${nextRole.replace('_', ' ')} menunggu verifikasi di Dashboard Admin.`,
        variant: 'default',
      })
    } catch {
      pushToast({
        title: 'Gagal mengirim permohonan',
        description: 'Terjadi kesalahan saat menyimpan permohonan perubahan peran.',
        variant: 'destructive',
      })
    }
  }

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

        {/* Notification bell dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                unreadCount > 0
                  ? `Notifikasi (${unreadCount} belum dibaca)`
                  : 'Notifikasi'
              }
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-foreground">
                Notifikasi Jurnal
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Tandai semua dibaca
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Belum ada notifikasi baru
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {notifications.map((notif) => (
                  <DropdownMenuItem
                    key={notif.id}
                    onClick={() => void handleNotificationClick(notif)}
                    className={cn(
                      'flex cursor-pointer flex-col items-start gap-1 px-3 py-2.5 text-xs',
                      !notif.is_read && 'bg-accent/50'
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full bg-primary"
                        />
                      )}
                    </div>
                    <p className="line-clamp-2 text-muted-foreground">
                      {notif.message}
                    </p>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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

          <DropdownMenuContent align="end" className="w-56">
            {/* Profile info header */}
            {profile && (
              <>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">
                    {profile.full_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Peran aktif: {profile.role.replace('_', ' ')}
                  </p>
                  {profile.requested_role && profile.requested_role !== profile.role && (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        Menunggu verifikasi: {profile.requested_role.replace('_', ' ')}
                      </span>
                    </div>
                  )}
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

            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              Ajukan Perubahan Peran
            </div>
            {(['Guru', 'Kepala_Sekolah', 'Staf_Admin'] as const).map((r) => {
              const isCurrent = profile?.role === r
              const isRequested = profile?.requested_role === r && !isCurrent
              return (
                <DropdownMenuItem
                  key={r}
                  disabled={isCurrent}
                  onClick={() => void handleRequestRoleChange(r)}
                  className={cn(
                    'cursor-pointer gap-2 text-xs',
                    isCurrent && 'bg-accent font-semibold text-accent-foreground opacity-100',
                    isRequested && 'text-amber-700 dark:text-amber-300 font-medium'
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {r.replace('_', ' ')}
                    {isCurrent ? ' (Aktif)' : isRequested ? ' (Menunggu)' : ''}
                  </span>
                </DropdownMenuItem>
              )
            })}

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

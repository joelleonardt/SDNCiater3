import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, BookOpenCheck, Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  hasTeacherSubmittedJournalOnDate,
  NOTIFICATIONS_UPDATED_EVENT,
} from '@/services/journalService'
import type { AppNotification } from '@/types/database.types'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Panel pengingat & notifikasi jurnal harian pada Dashboard Guru.
 * Menampilkan:
 * - Status apakah guru sudah mengisi jurnal harian untuk hari ini
 * - Daftar notifikasi pengingat dari Staf Admin & hasil tinjauan dari Kepala Sekolah
 */
export default function JournalReminderBanner() {
  const profile = useAuthStore((s) => s.profile)
  const navigate = useNavigate()

  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [hasSubmittedToday, setHasSubmittedToday] = React.useState<boolean | null>(null)
  const [loading, setLoading] = React.useState(true)

  const isGuru = profile?.role === 'Guru'

  const loadData = React.useCallback(async () => {
    if (!profile?.id || !profile?.school_id || !isGuru) {
      setLoading(false)
      return
    }
    try {
      const [notifs, submitted] = await Promise.all([
        getMyNotifications(profile.id, 10),
        hasTeacherSubmittedJournalOnDate(profile.school_id, profile.id, todayISO()),
      ])
      setNotifications(notifs)
      setHasSubmittedToday(submitted)
    } catch {
      // Abaikan kegagalan jaringan sementara pada banner dashboard
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.school_id, isGuru])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  React.useEffect(() => {
    function handleRefresh() {
      void loadData()
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleRefresh)
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleRefresh)
  }, [loadData])

  if (!isGuru || loading) return null

  const unreadNotifications = notifications.filter((n) => !n.is_read)

  if (hasSubmittedToday && unreadNotifications.length === 0) {
    return null
  }

  async function handleMarkRead(id: string) {
    await markNotificationAsRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  async function handleMarkAllRead() {
    if (!profile?.id) return
    await markAllNotificationsAsRead(profile.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  return (
    <div
      role="region"
      aria-label="Pengingat dan Notifikasi Jurnal Harian"
      className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/30"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            <BellRing className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {!hasSubmittedToday
                ? 'Anda belum mengisi Jurnal Harian untuk hari ini'
                : `Anda memiliki ${unreadNotifications.length} notifikasi jurnal belum dibaca`}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {!hasSubmittedToday
                ? 'Segera catat pelaksanaan kegiatan belajar mengajar hari ini agar dapat ditinjau oleh Kepala Sekolah.'
                : 'Tinjau pemberitahuan terbaru dari Kepala Sekolah atau Staf Admin di bawah ini.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {unreadNotifications.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleMarkAllRead()}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Tandai Semua Dibaca
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => navigate('/journals')}>
            <BookOpenCheck className="mr-1.5 h-3.5 w-3.5" />
            Buka Jurnal Harian
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {unreadNotifications.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-amber-200/80 pt-3 dark:border-amber-800/50">
          {unreadNotifications.map((notif) => (
            <li
              key={notif.id}
              className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs sm:flex-row sm:items-center"
            >
              <div>
                <span className="font-semibold text-foreground">{notif.title}: </span>
                <span className="text-muted-foreground">{notif.message}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleMarkRead(notif.id)}
                >
                  Tandai Dibaca
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

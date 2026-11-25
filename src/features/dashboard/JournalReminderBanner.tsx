import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellRing,
  BookOpenCheck,
  Check,
  ArrowRight,
  ClipboardCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/authStore'
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  hasTeacherSubmittedJournalOnDate,
  getDailyJournals,
  reviewDailyJournal,
  isUsingLocalJournalFallback,
  NOTIFICATIONS_UPDATED_EVENT,
  type DailyJournalWithDetails,
} from '@/services/journalService'
import JournalReviewModal, { JournalStatusBadge } from '@/features/journals/JournalReviewModal'
import type { AppNotification } from '@/types/database.types'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Panel Jurnal Harian pada Dashboard utama:
 * - Untuk Guru: menampilkan pengingat jika belum mengisi jurnal hari ini & notifikasi tinjauan/pengingat.
 * - Untuk Kepala Sekolah & Staf Admin: menampilkan daftar Jurnal Harian Guru terbaru yang baru diisi,
 *   ringkasan status tinjauan, serta tombol langsung untuk meninjau (Terima/Tolak) dari Dashboard.
 */
export default function JournalReminderBanner() {
  const profile = useAuthStore((s) => s.profile)
  const navigate = useNavigate()
  const { toastSuccess, toastError } = useToast()

  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [hasSubmittedToday, setHasSubmittedToday] = React.useState<boolean | null>(null)
  const [recentJournals, setRecentJournals] = React.useState<DailyJournalWithDetails[]>([])
  const [reviewingJournal, setReviewingJournal] =
    React.useState<DailyJournalWithDetails | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [usingFallback, setUsingFallback] = React.useState(false)

  const role = profile?.role
  const isGuru = role === 'Guru'
  const isKepsek = role === 'Kepala_Sekolah'
  const isAdmin = role === 'Staf_Admin'
  const isAdminOrKepsek = isKepsek || isAdmin

  const loadData = React.useCallback(async () => {
    if (!profile?.id || !profile?.school_id) {
      setLoading(false)
      return
    }
    try {
      if (isGuru) {
        const [notifs, submitted] = await Promise.all([
          getMyNotifications(profile.id, 10),
          hasTeacherSubmittedJournalOnDate(profile.school_id, profile.id, todayISO()),
        ])
        setNotifications(notifs)
        setHasSubmittedToday(submitted)
        setUsingFallback(isUsingLocalJournalFallback())
      } else if (isAdminOrKepsek) {
        const list = await getDailyJournals({
          schoolId: profile.school_id,
        })
        setRecentJournals(list)
        setUsingFallback(isUsingLocalJournalFallback())
      }
    } catch {
      // Abaikan kegagalan jaringan sementara pada banner dashboard
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.school_id, isGuru, isAdminOrKepsek])

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

  async function handleManualReload() {
    setRefreshing(true)
    try {
      await loadData()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleReviewFromDashboard(
    journalId: string,
    status: 'Disetujui' | 'Ditolak',
    reviewNotes: string
  ) {
    if (!profile) return
    try {
      await reviewDailyJournal({
        journal_id: journalId,
        reviewer_id: profile.id,
        status,
        review_notes: reviewNotes || null,
      })
      toastSuccess(
        status === 'Disetujui' ? 'Jurnal disetujui' : 'Jurnal ditolak',
        status === 'Disetujui'
          ? 'Jurnal harian telah diterima dan notifikasi dikirim ke guru.'
          : 'Jurnal harian ditolak beserta catatan revisi untuk guru.'
      )
      setReviewingJournal(null)
      await loadData()
    } catch (err) {
      toastError('Gagal menyimpan tinjauan', (err as Error).message)
    }
  }

  if (loading) return null

  // ── TAMPILAN DASHBOARD UNTUK KEPALA SEKOLAH & STAF ADMIN ───────────────────
  if (isAdminOrKepsek) {
    const pendingCount = recentJournals.filter((j) => j.status === 'Menunggu_Tinjauan').length
    const approvedCount = recentJournals.filter((j) => j.status === 'Disetujui').length
    const rejectedCount = recentJournals.filter((j) => j.status === 'Ditolak').length
    const topJournals = recentJournals.slice(0, 5)

    return (
      <section
        aria-label="Jurnal Harian Guru Terbaru"
        className="rounded-xl border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Jurnal Harian Guru Terbaru
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isKepsek
                ? 'Daftar jurnal harian yang dikirim guru untuk ditinjau (diterima atau ditolak).'
                : 'Pantau jurnal harian yang telah diisi guru dan kirimkan pengingat bagi yang belum mengisi.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void handleManualReload()}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Muat Ulang
            </Button>
            <Button type="button" size="sm" onClick={() => navigate('/journals')}>
              {isKepsek ? 'Lihat Semua Jurnal' : 'Pantau & Ingatkan Guru'}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Peringatan jika tabel SQL daily_journals belum dibuat di Supabase */}
        {usingFallback && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <span className="font-semibold">
                Tabel database <code>public.daily_journals</code> belum dijalankan di Supabase SQL
                Editor.
              </span>{' '}
              Saat ini jurnal hanya tersimpan di browser lokal perangkat guru dan belum
              tersinkronisasi antar-akun/browser. Jalankan skrip SQL tabel{' '}
              <code>daily_journals</code> &amp; <code>notifications</code> di Supabase SQL Editor
              agar jurnal guru langsung muncul di semua akun.
            </div>
          </div>
        )}

        {/* Ringkasan status jurnal */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-amber-50 px-3 py-1 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Menunggu Tinjauan: <strong>{pendingCount}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-50 px-3 py-1 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Disetujui: <strong>{approvedCount}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-red-50 px-3 py-1 font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Ditolak: <strong>{rejectedCount}</strong>
          </span>
        </div>

        {/* Daftar jurnal terbaru */}
        {topJournals.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
            Belum ada jurnal harian yang dikirim oleh guru.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border">
            {topJournals.map((j) => (
              <li
                key={j.id}
                className="flex flex-col justify-between gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{j.teacher_name}</span>
                    <span className="text-xs text-muted-foreground">
                      • {j.class_name} • {j.journal_date}
                    </span>
                    <JournalStatusBadge status={j.status} />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {j.subject} — <span className="font-normal text-muted-foreground">{j.topic}</span>
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{j.activities}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isKepsek && j.status === 'Menunggu_Tinjauan' ? 'default' : 'outline'}
                    onClick={() => setReviewingJournal(j)}
                  >
                    <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {isKepsek ? 'Tinjau' : 'Detail'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <JournalReviewModal
          open={Boolean(reviewingJournal)}
          journal={reviewingJournal}
          canReview={isKepsek}
          onReview={handleReviewFromDashboard}
          onClose={() => setReviewingJournal(null)}
        />
      </section>
    )
  }

  // ── TAMPILAN DASHBOARD UNTUK GURU ──────────────────────────────────────────
  if (!isGuru) return null

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

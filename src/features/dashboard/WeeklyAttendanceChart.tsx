import { useEffect, useState } from 'react'
import { getWeeklyAttendanceData, type WeeklyAttendanceDay } from '@/services/dashboardService'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/utils'
import EmptyState from '@/components/ui/EmptyState'
import { BarChart2 } from 'lucide-react'

/**
 * Chart kehadiran minggu berjalan (Senin–Minggu) untuk Dashboard.
 *
 * Requirements: 4.4
 */
export default function WeeklyAttendanceChart() {
  const profile = useAuthStore((s) => s.profile)
  const profileLoading = useAuthStore((s) => s.profileLoading)
  const [data, setData] = useState<WeeklyAttendanceDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.school_id) {
      if (!profileLoading) {
        setData([])
        setLoading(false)
      }
      return
    }

    const schoolId = profile.school_id
    let cancelled = false

    async function ambilData() {
      setLoading(true)
      setError(null)
      try {
        const result = await getWeeklyAttendanceData(schoolId)
        if (!cancelled) setData(result)
      } catch (e) {
        if (!cancelled) {
          const detail = getErrorMessage(e, '')
          setError(detail ? `Gagal memuat data kehadiran: ${detail}` : 'Gagal memuat data kehadiran.')
        }
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    ambilData()
    return () => {
      cancelled = true
    }
  }, [profile?.school_id, profileLoading])

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Memuat grafik kehadiran"
        aria-busy="true"
        className="flex flex-col gap-2"
      >
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="flex h-40 items-end gap-2 px-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full animate-pulse rounded-t bg-muted"
                style={{ height: `${40 + (i % 3) * 20}px` }}
              />
              <div className="h-3 w-6 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  const adaData = data.some((d) => d.total > 0)

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (!adaData) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Belum ada data kehadiran minggu ini"
        description="Data akan muncul setelah guru mengisi absensi."
        className="py-8"
      />
    )
  }

  // ─── Chart ──────────────────────────────────────────────────────────────────
  return (
    <div
      role="img"
      aria-label="Grafik kehadiran 7 hari terakhir"
      className="flex flex-col gap-1"
    >
      {/* Y-axis + bars */}
      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex w-8 flex-col justify-between text-right text-xs text-muted-foreground select-none">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* Bar area — tinggi tetap 160px agar persentase bar akurat */}
        <div className="relative flex h-40 flex-1 items-end gap-1.5 border-l border-b border-border">
          {/* Garis panduan 50% */}
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/50"
            style={{ bottom: '50%' }}
            aria-hidden="true"
          />
          {data.map((hari) => (
            <div
              key={hari.tanggal}
              className="group relative flex h-full flex-1 flex-col-reverse items-center"
            >
              {/* Bar */}
              <div
                className="w-full rounded-t bg-primary transition-all duration-300 hover:bg-primary/80"
                style={{ height: `${Math.max(hari.persen, hari.total > 0 ? 2 : 0)}%` }}
              />
              {/* Tooltip on hover */}
              <div
                className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100"
                role="tooltip"
              >
                {hari.label}: {hari.total > 0 ? `${hari.persen}%` : 'Tidak ada data'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-2">
        <div className="w-8" aria-hidden="true" />
        <div className="flex flex-1 gap-1.5">
          {data.map((hari) => (
            <div
              key={hari.tanggal}
              className="flex-1 text-center text-xs text-muted-foreground select-none"
            >
              {hari.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

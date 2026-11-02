import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import EmptyState from '@/components/ui/EmptyState'
import { BarChart2 } from 'lucide-react'

// Label hari Bahasa Indonesia — Senin = index 0
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

interface HariData {
  label: string   // "Sen", "Sel", dst.
  tanggal: string // "YYYY-MM-DD"
  persen: number  // 0-100
  total: number   // jumlah catatan hari itu
}

/** Hasilkan array 7 hari terakhir (hari ini inklusif), ISO date string */
function tujuhHariTerakhir(): string[] {
  const hasil: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    hasil.push(d.toISOString().slice(0, 10))
  }
  return hasil
}

/**
 * Chart kehadiran 7 hari terakhir untuk Dashboard.
 *
 * Requirements: 5.5, 5.6
 */
export default function WeeklyAttendanceChart() {
  const profile = useAuthStore((s) => s.profile)
  const [data, setData] = useState<HariData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.school_id) return

    const schoolId = profile.school_id
    const tanggalList = tujuhHariTerakhir()
    const dari = tanggalList[0]
    const sampai = tanggalList[tanggalList.length - 1]

    async function ambilData() {
      setLoading(true)
      setError(null)
      try {
        // Ambil semua catatan attendance 7 hari terakhir untuk school ini
        // (join via class_id → classes.school_id)
        // shortcut: tipe result di-cast manual karena Supabase TS tidak resolve !inner join, upgrade saat generate types diperbarui
        const { data: rows, error: err } = await supabase
          .from('attendance')
          .select('date, status, class_id, classes!inner(school_id)')
          .eq('classes.school_id', schoolId)
          .gte('date', dari)
          .lte('date', sampai) as unknown as {
            data: Array<{ date: string; status: string }> | null
            error: Error | null
          }

        if (err) throw err

        // Kelompokkan per tanggal
        const perTanggal: Record<string, { hadir: number; total: number }> = {}
        tanggalList.forEach((t) => {
          perTanggal[t] = { hadir: 0, total: 0 }
        })

        for (const row of rows ?? []) {
          if (perTanggal[row.date]) {
            perTanggal[row.date].total++
            if (row.status === 'Hadir') perTanggal[row.date].hadir++
          }
        }

        const result: HariData[] = tanggalList.map((tanggal) => {
          const { hadir, total } = perTanggal[tanggal]
          const dayIndex = new Date(tanggal + 'T00:00:00').getDay() // 0=Min
          // Konversi: getDay() 0=Min,1=Sen,...,6=Sab → HARI array 0=Sen..6=Min
          const labelIndex = dayIndex === 0 ? 6 : dayIndex - 1
          return {
            label: HARI[labelIndex],
            tanggal,
            persen: total > 0 ? Math.round((hadir / total) * 100) : 0,
            total,
          }
        })

        setData(result)
      } catch (e) {
        setError('Gagal memuat data kehadiran.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    ambilData()
  }, [profile?.school_id])

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

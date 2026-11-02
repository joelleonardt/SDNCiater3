import { useEffect, useState } from 'react'
import { Users, BookOpen, UserCheck, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getDashboardSummary, type DashboardSummary } from '@/services/dashboardService'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

// ─── Skeleton satu kartu ────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden="true" />
            <div className="h-7 w-16 animate-pulse rounded bg-muted" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Satu kartu ringkasan ────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  iconBg?: string
}

function SummaryCard({ icon, label, value, iconBg = 'bg-primary/10' }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', iconBg)}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Grid 4 kartu ───────────────────────────────────────────────────────────

/**
 * Menampilkan 4 kartu ringkasan dashboard:
 * total siswa, total kelas, kehadiran hari ini, catatan 7 hari.
 *
 * Requirements: 5.1, 5.2
 */
export default function SummaryCards() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.school_id) return

    setLoading(true)
    getDashboardSummary(profile.school_id, activeAcademicYear?.id ?? null)
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [profile?.school_id, activeAcademicYear?.id])

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Memuat ringkasan..."
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
        <span className="sr-only">Memuat data ringkasan...</span>
      </div>
    )
  }

  const kehadiranLabel =
    summary?.persentaseKehadiran !== null && summary?.persentaseKehadiran !== undefined
      ? `${summary.persentaseKehadiran}%`
      : '—'

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <SummaryCard
        icon={<Users className="h-6 w-6 text-blue-600" />}
        iconBg="bg-blue-100"
        label="Total Siswa"
        value={String(summary?.totalSiswa ?? 0)}
      />
      <SummaryCard
        icon={<BookOpen className="h-6 w-6 text-emerald-600" />}
        iconBg="bg-emerald-100"
        label="Total Kelas"
        value={String(summary?.totalKelas ?? 0)}
      />
      <SummaryCard
        icon={<UserCheck className="h-6 w-6 text-violet-600" />}
        iconBg="bg-violet-100"
        label="Kehadiran Hari Ini"
        value={kehadiranLabel}
      />
      <SummaryCard
        icon={<FileText className="h-6 w-6 text-amber-600" />}
        iconBg="bg-amber-100"
        label="Catatan (7 Hari)"
        value={String(summary?.totalCatatan7Hari ?? 0)}
      />
    </div>
  )
}

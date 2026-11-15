import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { getRecentNotesForDashboard, type DashboardNoteItem } from '@/services/dashboardService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  })
}

export default function AnnouncementsPanel() {
  const profile = useAuthStore((s) => s.profile)
  const profileLoading = useAuthStore((s) => s.profileLoading)
  const [items, setItems] = useState<DashboardNoteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.school_id) {
      if (!profileLoading) {
        setItems([])
        setLoading(false)
      }
      return
    }

    let cancelled = false
    setLoading(true)
    getRecentNotesForDashboard(profile.school_id)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile?.school_id, profileLoading])

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Catatan Terbaru
        </h2>
        {items.length > 0 && (
          <Link
            to="/students"
            className="text-xs text-primary hover:underline"
          >
            Lihat semua
          </Link>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Tidak ada catatan terbaru
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">{item.student_name}</span>
                <div className="flex items-center gap-2">
                  <CategoryBadge category={item.category} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.note_date)}
                  </span>
                </div>
              </div>
              <p className="line-clamp-2 text-muted-foreground">{item.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CategoryBadge({ category }: { category: 'Perilaku' | 'Prestasi' }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        category === 'Perilaku'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-green-100 text-green-800'
      )}
    >
      {category}
    </span>
  )
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <ul className="space-y-2" role="status" aria-label="Memuat catatan...">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="rounded-md bg-muted/40 px-3 py-2" aria-hidden="true">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
        </li>
      ))}
      <span className="sr-only">Memuat catatan...</span>
    </ul>
  )
}

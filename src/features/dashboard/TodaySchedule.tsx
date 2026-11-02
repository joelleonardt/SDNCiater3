import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

interface ScheduleItem {
  id: string
  subject: string
  class_name: string
  start_time: string
  end_time: string
}

// Pemetaan getDay() (0=Minggu) ke day_of_week (1=Senin…6=Sabtu)
function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay() // 0=Sun, 1=Mon, …, 6=Sat
  return jsDay === 0 ? 0 : jsDay   // Minggu (0) tidak masuk 1–6, kembalikan 0
}

function formatTime(time: string): string {
  return time.slice(0, 5) // "07:30:00" → "07:30"
}

export default function TodaySchedule() {
  const profile = useAuthStore((s) => s.profile)
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return

    const dayOfWeek = getTodayDayOfWeek()
    if (dayOfWeek === 0) {
      // Hari Minggu — tidak ada jadwal
      setItems([])
      setLoading(false)
      return
    }

    supabase
      .from('schedules')
      .select('id, subject, start_time, end_time, classes(name)')
      .eq('teacher_id', profile.id)
      .eq('day_of_week', dayOfWeek)
      .order('start_time')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: { data: any[] | null; error: unknown }) => {
        if (!error && data) {
          setItems(
            data.map((row) => ({
              id: row.id,
              subject: row.subject,
              class_name: (row.classes as { name: string } | null)?.name ?? '—',
              start_time: row.start_time,
              end_time: row.end_time,
            }))
          )
        }
        setLoading(false)
      })
  }, [profile?.id])

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Jadwal Hari Ini
      </h2>

      {loading ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Tidak ada jadwal hari ini
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{item.subject}</span>
                <span className="ml-2 text-muted-foreground">{item.class_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTime(item.start_time)} – {formatTime(item.end_time)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <ul className="space-y-2" role="status" aria-label="Memuat jadwal...">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className={cn(
            'flex items-center justify-between rounded-md bg-muted/40 px-3 py-2',
          )}
          aria-hidden="true"
        >
          <div className="flex gap-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </li>
      ))}
      <span className="sr-only">Memuat jadwal...</span>
    </ul>
  )
}

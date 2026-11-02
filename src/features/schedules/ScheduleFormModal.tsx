import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Schedule } from '@/types/database.types'

// ─── Hari dalam seminggu ─────────────────────────────────────────────────────

export const HARI = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
] as const

// ─── Skema validasi ──────────────────────────────────────────────────────────

const jadwalSchema = z
  .object({
    subject: z.string().min(1, 'Mata pelajaran wajib diisi').max(100, 'Maksimal 100 karakter'),
    day_of_week: z
      .number({ invalid_type_error: 'Hari wajib dipilih' })
      .int()
      .min(1)
      .max(6),
    start_time: z.string().min(1, 'Jam mulai wajib diisi'),
    end_time: z.string().min(1, 'Jam selesai wajib diisi'),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: 'Jam selesai harus lebih besar dari jam mulai',
    path: ['end_time'],
  })

export type JadwalForm = z.infer<typeof jadwalSchema>

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ScheduleFormModalProps {
  /** Data jadwal untuk mode edit; undefined untuk tambah */
  initialData?: Schedule
  /** Hari yang dipilih sebelumnya (dari klik kolom WeeklyGrid) */
  defaultDay?: number
  /** Apakah form sedang disubmit */
  isSubmitting: boolean
  /** Pesan error dari server (misal: konflik jadwal) */
  serverError?: string | null
  /** Dipanggil saat user klik Simpan dengan data yang valid */
  onSubmit: (data: JadwalForm) => void
  /** Dipanggil saat user klik Batal atau tutup */
  onCancel: () => void
}

/**
 * Modal form tambah/edit jadwal pelajaran.
 * - Fields: mata pelajaran, hari, jam mulai, jam selesai
 * - Guru pengajar: otomatis dari profil user saat ini (dikelola di SchedulePage)
 * - Validasi: jam selesai > jam mulai, UNIQUE conflict ditampilkan sebagai serverError
 * Requirements: 10.3, 10.4
 */
export default function ScheduleFormModal({
  initialData,
  defaultDay,
  isSubmitting,
  serverError,
  onSubmit,
  onCancel,
}: ScheduleFormModalProps) {
  const isEdit = !!initialData

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JadwalForm>({
    resolver: zodResolver(jadwalSchema),
    defaultValues: {
      subject: initialData?.subject ?? '',
      day_of_week: initialData?.day_of_week ?? defaultDay ?? 1,
      start_time: initialData?.start_time ?? '',
      end_time: initialData?.end_time ?? '',
    },
  })

  // Tutup saat Escape
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Cegah scroll background
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-form-title"
        className={cn(
          'w-full max-w-md rounded-lg border border-border bg-background shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <h2 id="schedule-form-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* Error server (misal: konflik jadwal) */}
            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            {/* Mata Pelajaran */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-subject">
                Mata Pelajaran <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="sched-subject"
                placeholder="Contoh: Matematika"
                autoFocus
                aria-invalid={!!errors.subject}
                aria-describedby={errors.subject ? 'sched-subject-error' : undefined}
                {...register('subject')}
              />
              {errors.subject && (
                <p id="sched-subject-error" role="alert" className="text-xs text-destructive">
                  {errors.subject.message}
                </p>
              )}
            </div>

            {/* Hari */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-day">
                Hari <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <select
                id="sched-day"
                aria-invalid={!!errors.day_of_week}
                aria-describedby={errors.day_of_week ? 'sched-day-error' : undefined}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                {...register('day_of_week', { valueAsNumber: true })}
              >
                {HARI.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
              {errors.day_of_week && (
                <p id="sched-day-error" role="alert" className="text-xs text-destructive">
                  {errors.day_of_week.message}
                </p>
              )}
            </div>

            {/* Jam Mulai & Selesai */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sched-start">
                  Jam Mulai <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="sched-start"
                  type="time"
                  aria-invalid={!!errors.start_time}
                  aria-describedby={errors.start_time ? 'sched-start-error' : undefined}
                  {...register('start_time')}
                />
                {errors.start_time && (
                  <p id="sched-start-error" role="alert" className="text-xs text-destructive">
                    {errors.start_time.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sched-end">
                  Jam Selesai <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="sched-end"
                  type="time"
                  aria-invalid={!!errors.end_time}
                  aria-describedby={errors.end_time ? 'sched-end-error' : undefined}
                  {...register('end_time')}
                />
                {errors.end_time && (
                  <p id="sched-end-error" role="alert" className="text-xs text-destructive">
                    {errors.end_time.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Menyimpan…
                </span>
              ) : (
                'Simpan'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

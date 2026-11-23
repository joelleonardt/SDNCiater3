import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Class } from '@/types/database.types'
import type { DailyJournalWithDetails } from '@/services/journalService'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const journalSchema = z.object({
  journal_date: z
    .string()
    .min(1, 'Tanggal jurnal wajib diisi')
    .refine((val) => val <= todayISO(), {
      message: 'Tanggal jurnal tidak boleh di masa depan',
    }),
  class_id: z.string().min(1, 'Kelas wajib dipilih'),
  subject: z
    .string()
    .trim()
    .min(1, 'Mata pelajaran wajib diisi')
    .max(100, 'Mata pelajaran maksimal 100 karakter'),
  topic: z
    .string()
    .trim()
    .min(1, 'Materi/topik pembelajaran wajib diisi')
    .max(255, 'Materi/topik maksimal 255 karakter'),
  activities: z
    .string()
    .trim()
    .min(1, 'Kegiatan & catatan pembelajaran wajib diisi')
    .max(2000, 'Kegiatan & catatan maksimal 2000 karakter'),
})

export type JournalFormValues = z.infer<typeof journalSchema>

export interface JournalFormModalProps {
  open: boolean
  initialData?: DailyJournalWithDetails
  classes: Class[]
  onSubmit: (values: JournalFormValues) => Promise<void>
  onClose: () => void
}

export default function JournalFormModal({
  open,
  initialData,
  classes,
  onSubmit,
  onClose,
}: JournalFormModalProps) {
  const isEdit = Boolean(initialData)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      journal_date: initialData?.journal_date ?? todayISO(),
      class_id: initialData?.class_id ?? (classes[0]?.id ?? ''),
      subject: initialData?.subject ?? '',
      topic: initialData?.topic ?? '',
      activities: initialData?.activities ?? '',
    },
  })

  React.useEffect(() => {
    if (open) {
      reset({
        journal_date: initialData?.journal_date ?? todayISO(),
        class_id: initialData?.class_id ?? (classes[0]?.id ?? ''),
        subject: initialData?.subject ?? '',
        topic: initialData?.topic ?? '',
        activities: initialData?.activities ?? '',
      })
    }
  }, [open, initialData, classes, reset])

  React.useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleValidSubmit(values: JournalFormValues) {
    await onSubmit(values)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-form-title"
        className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="journal-form-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Jurnal Harian' : 'Buat Jurnal Harian'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isEdit
              ? 'Perbarui isi jurnal mengajar untuk diajukan kembali ke Kepala Sekolah.'
              : 'Catat pelaksanaan pembelajaran harian untuk ditinjau Kepala Sekolah.'}
          </p>
        </div>

        <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
          <div className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-5">
            {initialData?.status === 'Ditolak' && initialData.review_notes && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Catatan Revisi Kepala Sekolah: </span>
                  <span>{initialData.review_notes}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="journal-date">
                  Tanggal <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="journal-date"
                  type="date"
                  max={todayISO()}
                  aria-invalid={Boolean(errors.journal_date)}
                  {...register('journal_date')}
                />
                {errors.journal_date && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.journal_date.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal-class">
                  Kelas <span className="text-destructive">*</span>
                </Label>
                <select
                  id="journal-class"
                  aria-invalid={Boolean(errors.class_id)}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                  {...register('class_id')}
                >
                  <option value="">— Pilih Kelas —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.class_id && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.class_id.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="journal-subject">
                Mata Pelajaran <span className="text-destructive">*</span>
              </Label>
              <Input
                id="journal-subject"
                placeholder="Contoh: Matematika / Bahasa Indonesia"
                aria-invalid={Boolean(errors.subject)}
                {...register('subject')}
              />
              {errors.subject && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.subject.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="journal-topic">
                Materi / Topik Pembelajaran <span className="text-destructive">*</span>
              </Label>
              <Input
                id="journal-topic"
                placeholder="Contoh: Operasi Hitung Pecahan Campuran"
                aria-invalid={Boolean(errors.topic)}
                {...register('topic')}
              />
              {errors.topic && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.topic.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="journal-activities">
                Kegiatan &amp; Catatan Pembelajaran <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="journal-activities"
                rows={4}
                placeholder="Tuliskan ringkasan kegiatan belajar mengajar, metode, serta kendala atau catatan siswa di kelas..."
                aria-invalid={Boolean(errors.activities)}
                className={cn(
                  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
                {...register('activities')}
              />
              {errors.activities && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.activities.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Simpan & Ajukan Ulang' : 'Simpan Jurnal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

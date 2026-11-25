import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Loader2, Save, Eraser, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  SD_CURRICULUM_PRESETS,
  type CurriculumTpItem,
  type DailyJournalWithDetails,
} from '@/services/journalService'
import type { Class } from '@/types/database.types'

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
    .min(1, 'Mata pelajaran wajib dipilih')
    .max(100, 'Mata pelajaran maksimal 100 karakter'),
  cp: z.string().max(600, 'Capaian Pembelajaran maksimal 600 karakter').optional(),
  tp: z.string().max(600, 'Tujuan Pembelajaran maksimal 600 karakter').optional(),
  topic: z
    .string()
    .trim()
    .min(1, 'Materi pokok wajib diisi')
    .max(255, 'Materi pokok maksimal 255 karakter'),
  iktp: z.string().max(255, 'Indikator (IKTP) maksimal 255 karakter').optional(),
  method: z.string().max(150, 'Metode maksimal 150 karakter').optional(),
  media: z.string().max(150, 'Media maksimal 150 karakter').optional(),
  activities: z
    .string()
    .trim()
    .min(1, 'Refleksi & catatan pembelajaran wajib diisi')
    .max(1500, 'Refleksi & catatan maksimal 1500 karakter'),
})

export type JournalFormValues = z.infer<typeof journalSchema>

export interface JournalFormCardProps {
  initialData?: DailyJournalWithDetails
  classes: Class[]
  defaultClassId?: string
  curriculumTps?: CurriculumTpItem[]
  onSubmit: (values: JournalFormValues) => Promise<void>
  onCancel?: () => void
  isModal?: boolean
}

export function JournalFormFields({
  initialData,
  classes,
  defaultClassId,
  curriculumTps = [],
  onSubmit,
  onCancel,
  isModal = false,
}: JournalFormCardProps) {
  const isEdit = Boolean(initialData)
  const autoClassId = initialData?.class_id || defaultClassId || classes[0]?.id || ''

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      journal_date: initialData?.journal_date ?? todayISO(),
      class_id: autoClassId,
      subject: initialData?.subject ?? '',
      cp: initialData?.cp ?? '',
      tp: initialData?.tp ?? '',
      topic: initialData?.topic ?? '',
      iktp: initialData?.iktp ?? '',
      method: initialData?.method ?? '',
      media: initialData?.media ?? '',
      activities: initialData?.reflection || initialData?.activities || '',
    },
  })

  const [selectedTpOption, setSelectedTpOption] = React.useState('')

  React.useEffect(() => {
    reset({
      journal_date: initialData?.journal_date ?? todayISO(),
      class_id: initialData?.class_id || defaultClassId || classes[0]?.id || '',
      subject: initialData?.subject ?? '',
      cp: initialData?.cp ?? '',
      tp: initialData?.tp ?? '',
      topic: initialData?.topic ?? '',
      iktp: initialData?.iktp ?? '',
      method: initialData?.method ?? '',
      media: initialData?.media ?? '',
      activities: initialData?.reflection || initialData?.activities || '',
    })
    setSelectedTpOption('')
  }, [initialData, defaultClassId, classes, reset])

  const watchedSubject = watch('subject')
  const watchedClassId = watch('class_id')
  const watchedTp = watch('tp')

  const selectedClassObj = React.useMemo(
    () => classes.find((c) => c.id === watchedClassId),
    [classes, watchedClassId]
  )

  // Ambil Master Data TP kustom yang cocok dengan Mata Pelajaran (& Kelas bila sesuai)
  const matchingCustomTps = React.useMemo(() => {
    if (!watchedSubject) return []
    const bySubject = curriculumTps.filter((item) => item.subject === watchedSubject)
    if (!selectedClassObj) return bySubject
    const classNameLabel = `Kelas ${selectedClassObj.name}`
    const gradeLabel = `Kelas ${selectedClassObj.grade_level}`
    const filteredByClass = bySubject.filter(
      (item) =>
        item.class_level === classNameLabel ||
        item.class_level === gradeLabel ||
        item.class_level === selectedClassObj.name
    )
    return filteredByClass.length > 0 ? filteredByClass : bySubject
  }, [curriculumTps, watchedSubject, selectedClassObj])

  const subjectPreset = React.useMemo(
    () => SD_CURRICULUM_PRESETS.find((p) => p.subject === watchedSubject),
    [watchedSubject]
  )

  const combinedTpOptions = React.useMemo(() => {
    const customFormatted = matchingCustomTps.map(
      (item) => `${item.tp_code} - ${item.tp_description}`
    )
    const presetOptions = subjectPreset?.tpOptions ?? []
    return Array.from(new Set([...customFormatted, ...presetOptions]))
  }, [matchingCustomTps, subjectPreset])

  const subjectOptions = React.useMemo(() => {
    const names = SD_CURRICULUM_PRESETS.map((p) => p.subject)
    if (initialData?.subject && !names.includes(initialData.subject)) {
      return [initialData.subject, ...names]
    }
    return names
  }, [initialData?.subject])

  const subjectRegister = register('subject')

  function handleSelectTpOption(tpText: string) {
    setSelectedTpOption('')
    if (!tpText) return
    const currentTp = (watchedTp ?? '').trim()
    if (!currentTp) {
      setValue('tp', tpText, { shouldDirty: true })
    } else if (!currentTp.includes(tpText)) {
      setValue('tp', `${currentTp}\n• ${tpText}`, { shouldDirty: true })
    }
  }

  async function handleValidSubmit(values: JournalFormValues) {
    await onSubmit(values)
    if (!isEdit && !isModal) {
      reset({
        journal_date: values.journal_date,
        class_id: values.class_id,
        subject: '',
        cp: '',
        tp: '',
        topic: '',
        iktp: '',
        method: '',
        media: '',
        activities: '',
      })
      setSelectedTpOption('')
    }
  }

  const selectClass = cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  )

  const textareaClass = cn(
    'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  )

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <div className={cn('space-y-4', isModal ? 'max-h-[75vh] overflow-y-auto px-6 py-5' : '')}>
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

        {/* Baris 1: Tanggal Pembelajaran & Kelas (Otomatis) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="journal-date">
              Tanggal Pembelajaran <span className="text-destructive">*</span>
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
              Kelas (Otomatis) <span className="text-destructive">*</span>
            </Label>
            <select
              id="journal-class"
              aria-invalid={Boolean(errors.class_id)}
              className={cn(selectClass, 'bg-muted/40')}
              {...register('class_id')}
            >
              <option value="">-- Pilih Kelas --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
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

        {/* Baris 2: Mata Pelajaran */}
        <div className="space-y-1.5">
          <Label htmlFor="journal-subject">
            Mata Pelajaran <span className="text-destructive">*</span>
          </Label>
          <select
            id="journal-subject"
            aria-invalid={Boolean(errors.subject)}
            className={selectClass}
            {...subjectRegister}
            onChange={(e) => {
              subjectRegister.onChange(e)
              const nextSubject = e.target.value
              const customMatch = curriculumTps.find((item) => item.subject === nextSubject && item.cp)
              if (customMatch) {
                setValue('cp', customMatch.cp, { shouldDirty: true })
                return
              }
              const preset = SD_CURRICULUM_PRESETS.find((p) => p.subject === nextSubject)
              if (preset) {
                setValue('cp', preset.defaultCp, { shouldDirty: true })
              }
            }}
          >
            <option value="">-- Pilih Mapel --</option>
            {subjectOptions.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>
          {errors.subject && (
            <p role="alert" className="text-xs text-destructive">
              {errors.subject.message}
            </p>
          )}
        </div>

        {/* Baris 3: Capaian Pembelajaran (CP) */}
        <div className="space-y-1.5">
          <Label htmlFor="journal-cp">Capaian Pembelajaran (CP)</Label>
          <textarea
            id="journal-cp"
            rows={2}
            placeholder="Capaian Pembelajaran (CP) akan terisi otomatis saat memilih Mata Pelajaran atau dapat diketik manual..."
            className={textareaClass}
            {...register('cp')}
          />
        </div>

        {/* Baris 4: Pilih Tujuan Pembelajaran (TP) + Textarea TP + Bersihkan TP */}
        <div className="space-y-2">
          <Label htmlFor="journal-tp-picker">Pilih Tujuan Pembelajaran (TP)</Label>
          <select
            id="journal-tp-picker"
            value={selectedTpOption}
            disabled={!watchedSubject}
            onChange={(e) => handleSelectTpOption(e.target.value)}
            className={selectClass}
          >
            <option value="">
              {watchedSubject
                ? '-- Pilih Tujuan Pembelajaran (TP) untuk ditambahkan --'
                : '-- Pilih Mapel Dahulu --'}
            </option>
            {combinedTpOptions.map((tpItem) => (
              <option key={tpItem} value={tpItem}>
                {tpItem}
              </option>
            ))}
          </select>

          <textarea
            id="journal-tp"
            rows={2}
            placeholder="TP yang Anda pilih akan muncul di sini..."
            aria-label="Tujuan Pembelajaran (TP)"
            className={cn(textareaClass, 'font-mono text-xs')}
            {...register('tp')}
          />

          <div>
            <button
              type="button"
              onClick={() => setValue('tp', '', { shouldDirty: true })}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              Bersihkan TP
            </button>
          </div>
        </div>

        {/* Baris 5: Materi Pokok | Indikator (IKTP) | Metode */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="journal-topic">
              Materi Pokok <span className="text-destructive">*</span>
            </Label>
            <Input
              id="journal-topic"
              placeholder="Contoh: Pecahan Senilai"
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
            <Label htmlFor="journal-iktp">Indikator (IKTP)</Label>
            <Input
              id="journal-iktp"
              placeholder="Contoh: Menentukan nilai pecahan"
              {...register('iktp')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="journal-method">Metode</Label>
            <Input
              id="journal-method"
              placeholder="Contoh: Diskusi, Tanya Jawab"
              {...register('method')}
            />
          </div>
        </div>

        {/* Baris 6: Media */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="journal-media">Media</Label>
            <Input
              id="journal-media"
              placeholder="Contoh: Buku Paket, Alat Peraga, LKPD"
              {...register('media')}
            />
          </div>
        </div>

        {/* Baris 7: Refleksi & Catatan */}
        <div className="space-y-1.5">
          <Label htmlFor="journal-activities">
            Refleksi &amp; Catatan <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="journal-activities"
            rows={3}
            placeholder="Tuliskan refleksi pembelajaran hari ini, ketercapaian siswa, serta kendala atau tindak lanjut..."
            aria-invalid={Boolean(errors.activities)}
            className={textareaClass}
            {...register('activities')}
          />
          {errors.activities && (
            <p role="alert" className="text-xs text-destructive">
              {errors.activities.message}
            </p>
          )}
        </div>
      </div>

      {isModal ? (
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Batal
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEdit ? 'Simpan & Ajukan Ulang' : 'Simpan Jurnal ke Sistem'}
          </Button>
        </div>
      ) : (
        <div className="pt-4">
          <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan Jurnal ke Sistem
          </Button>
        </div>
      )}
    </form>
  )
}

export interface JournalFormModalProps {
  open: boolean
  initialData?: DailyJournalWithDetails
  classes: Class[]
  defaultClassId?: string
  curriculumTps?: CurriculumTpItem[]
  onSubmit: (values: JournalFormValues) => Promise<void>
  onClose: () => void
}

export default function JournalFormModal({
  open,
  initialData,
  classes,
  defaultClassId,
  curriculumTps,
  onSubmit,
  onClose,
}: JournalFormModalProps) {
  const isEdit = Boolean(initialData)

  React.useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

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
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h2
            id="journal-form-title"
            className="flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            {isEdit ? 'Edit Jurnal Pembelajaran' : 'Input Jurnal Hari Ini'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isEdit
              ? 'Perbarui isi jurnal pembelajaran untuk diajukan kembali ke Kepala Sekolah.'
              : 'Catat pelaksanaan pembelajaran harian untuk ditinjau Kepala Sekolah.'}
          </p>
        </div>

        <JournalFormFields
          initialData={initialData}
          classes={classes}
          defaultClassId={defaultClassId}
          curriculumTps={curriculumTps}
          onSubmit={onSubmit}
          onCancel={onClose}
          isModal
        />
      </div>
    </div>
  )
}

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Class, Profile } from '@/types/database.types'

const SD_GRADES = [1, 2, 3, 4, 5, 6] as const
const SD_SECTIONS = ['A', 'B'] as const

function extractSection(name?: string | null): 'A' | 'B' | '' {
  if (!name) return ''
  const upper = name.trim().toUpperCase()
  if (upper.endsWith('A')) return 'A'
  if (upper.endsWith('B')) return 'B'
  return ''
}

// ─── Skema validasi ──────────────────────────────────────────────────────────

const kelasSchema = z.object({
  grade_level: z
    .number({
      error: (iss) => (iss.code === 'invalid_type' ? 'Kelas wajib dipilih' : undefined),
    })
    .int('Kelas harus bilangan bulat')
    .min(1, 'Kelas minimal 1')
    .max(6, 'Kelas maksimal 6'),
  section: z.enum(['A', 'B'], {
    error: 'Tingkat kelas (A / B) wajib dipilih',
  }),
  homeroom_teacher_id: z.string().optional(),
})

type KelasFormInput = z.infer<typeof kelasSchema>

export interface KelasSubmitData {
  name: string
  grade_level: number
  homeroom_teacher_id?: string
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ClassFormModalProps {
  /** Data kelas untuk mode edit; undefined untuk tambah */
  initialData?: Class & { homeroom_teacher_name?: string | null }
  /** Daftar guru aktif untuk pilihan wali kelas */
  teachers?: Profile[]
  /** Pesan error dari server (misal nama kelas duplikat) */
  serverError?: string | null
  /** Apakah form sedang disubmit */
  isSubmitting: boolean
  /** Dipanggil saat user klik Simpan dengan data yang valid */
  onSubmit: (data: KelasSubmitData) => void
  /** Dipanggil saat user klik Batal atau tutup */
  onCancel: () => void
}

/**
 * Modal form tambah/edit kelas SD.
 * - Pilih Kelas: 1–6
 * - Tingkat Kelas: A atau B
 * - Wali Kelas: select dari akun Guru aktif
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export default function ClassFormModal({
  initialData,
  teachers = [],
  serverError,
  isSubmitting,
  onSubmit,
  onCancel,
}: ClassFormModalProps) {
  const isEdit = !!initialData

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<KelasFormInput>({
    resolver: zodResolver(kelasSchema),
    defaultValues: {
      grade_level: initialData?.grade_level ?? undefined,
      section: (extractSection(initialData?.name) || undefined) as 'A' | 'B' | undefined,
      homeroom_teacher_id: initialData?.homeroom_teacher_id ?? '',
    },
  })

  function handleFormValid(values: KelasFormInput) {
    onSubmit({
      name: `${values.grade_level}${values.section}`,
      grade_level: values.grade_level,
      homeroom_teacher_id: values.homeroom_teacher_id,
    })
  }

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
        aria-labelledby="class-form-title"
        className={cn(
          'w-full max-w-md rounded-lg border border-border bg-background shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <h2 id="class-form-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Kelas' : 'Tambah Kelas'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormValid)} noValidate>
          <div className="space-y-4 px-6 py-5">
            {serverError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {serverError}
              </p>
            )}

            {/* Pilih Kelas (1 - 6) */}
            <div className="space-y-1.5">
              <Label htmlFor="grade-level">
                Pilih Kelas <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <select
                id="grade-level"
                autoFocus
                aria-invalid={!!errors.grade_level}
                aria-describedby={errors.grade_level ? 'grade-level-error' : undefined}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                {...register('grade_level', { valueAsNumber: true })}
              >
                <option value="">-- Pilih kelas --</option>
                {SD_GRADES.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Kelas {lvl}
                  </option>
                ))}
              </select>
              {errors.grade_level && (
                <p id="grade-level-error" role="alert" className="text-xs text-destructive">
                  {errors.grade_level.message}
                </p>
              )}
            </div>

            {/* Tingkat Kelas (A / B) */}
            <div className="space-y-1.5">
              <Label htmlFor="class-section">
                Tingkat Kelas <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <select
                id="class-section"
                aria-invalid={!!errors.section}
                aria-describedby={errors.section ? 'class-section-error' : undefined}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                {...register('section')}
              >
                <option value="">-- Pilih tingkat --</option>
                {SD_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
              {errors.section && (
                <p id="class-section-error" role="alert" className="text-xs text-destructive">
                  {errors.section.message}
                </p>
              )}
            </div>

            {/* Wali Kelas */}
            <div className="space-y-1.5">
              <Label htmlFor="homeroom-teacher">Wali Kelas</Label>
              <select
                id="homeroom-teacher"
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                {...register('homeroom_teacher_id')}
              >
                <option value="">-- Pilih wali kelas (opsional) --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
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

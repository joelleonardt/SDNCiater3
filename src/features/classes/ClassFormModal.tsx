import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Class } from '@/types/database.types'

// ─── Skema validasi ──────────────────────────────────────────────────────────

const kelasSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama kelas wajib diisi')
    .max(50, 'Nama kelas maksimal 50 karakter'),
  grade_level: z
    .number({ invalid_type_error: 'Tingkat kelas wajib dipilih' })
    .int()
    .min(1, 'Tingkat minimal 1')
    .max(12, 'Tingkat maksimal 12'),
  homeroom_teacher_name: z.string().max(100, 'Nama wali kelas terlalu panjang').optional(),
})

type KelasForm = z.infer<typeof kelasSchema>

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ClassFormModalProps {
  /** Data kelas untuk mode edit; undefined untuk tambah */
  initialData?: Class & { homeroom_teacher_name?: string }
  /** Apakah form sedang disubmit */
  isSubmitting: boolean
  /** Dipanggil saat user klik Simpan dengan data yang valid */
  onSubmit: (data: KelasForm) => void
  /** Dipanggil saat user klik Batal atau tutup */
  onCancel: () => void
}

/**
 * Modal form tambah/edit kelas.
 * - Fields: nama kelas, tingkat kelas (select 1–12), wali kelas (text, opsional)
 * - Validasi: nama max 50 karakter, tingkat 1–12
 * Requirements: 7.1, 7.2, 7.3
 */
export default function ClassFormModal({
  initialData,
  isSubmitting,
  onSubmit,
  onCancel,
}: ClassFormModalProps) {
  const isEdit = !!initialData

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<KelasForm>({
    resolver: zodResolver(kelasSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      grade_level: initialData?.grade_level ?? undefined,
      homeroom_teacher_name: initialData?.homeroom_teacher_name ?? '',
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
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* Nama Kelas */}
            <div className="space-y-1.5">
              <Label htmlFor="class-name">
                Nama Kelas <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="class-name"
                placeholder="Contoh: VII A"
                autoFocus
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'class-name-error' : undefined}
                {...register('name')}
              />
              {errors.name && (
                <p id="class-name-error" role="alert" className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Tingkat Kelas */}
            <div className="space-y-1.5">
              <Label htmlFor="grade-level">
                Tingkat Kelas <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <select
                id="grade-level"
                aria-invalid={!!errors.grade_level}
                aria-describedby={errors.grade_level ? 'grade-level-error' : undefined}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                {...register('grade_level', { valueAsNumber: true })}
              >
                <option value="">-- Pilih tingkat --</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Tingkat {lvl}
                  </option>
                ))}
              </select>
              {errors.grade_level && (
                <p id="grade-level-error" role="alert" className="text-xs text-destructive">
                  {errors.grade_level.message}
                </p>
              )}
            </div>

            {/* Wali Kelas */}
            <div className="space-y-1.5">
              <Label htmlFor="homeroom-teacher">Wali Kelas</Label>
              <Input
                id="homeroom-teacher"
                placeholder="Nama wali kelas (opsional)"
                aria-invalid={!!errors.homeroom_teacher_name}
                aria-describedby={
                  errors.homeroom_teacher_name ? 'homeroom-teacher-error' : undefined
                }
                {...register('homeroom_teacher_name')}
              />
              {errors.homeroom_teacher_name && (
                <p id="homeroom-teacher-error" role="alert" className="text-xs text-destructive">
                  {errors.homeroom_teacher_name.message}
                </p>
              )}
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

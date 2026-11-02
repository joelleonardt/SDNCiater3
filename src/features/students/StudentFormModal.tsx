import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Student } from '@/types/database.types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const studentSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Nama lengkap wajib diisi')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
  nis: z
    .string()
    .min(1, 'NIS wajib diisi')
    .max(20, 'NIS maksimal 20 karakter'),
  gender: z.enum(['Laki-laki', 'Perempuan'], {
    required_error: 'Jenis kelamin wajib dipilih',
  }),
  date_of_birth: z.string().min(1, 'Tanggal lahir wajib diisi'),
  parent_name: z
    .string()
    .max(100, 'Nama orang tua maksimal 100 karakter')
    .optional()
    .or(z.literal('')),
  parent_contact: z
    .string()
    .max(20, 'Kontak orang tua maksimal 20 karakter')
    .optional()
    .or(z.literal('')),
})

export type StudentFormValues = z.infer<typeof studentSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StudentFormModalProps {
  /** Apakah modal terbuka */
  open: boolean
  /** Data siswa untuk mode edit; undefined berarti mode tambah */
  student?: Student
  /** Dipanggil dengan nilai form saat user menekan Simpan */
  onSubmit: (values: StudentFormValues) => Promise<void>
  /** Dipanggil saat user menutup modal */
  onClose: () => void
}

/**
 * Modal form tambah/edit siswa.
 * Gunakan onSubmit async untuk menampilkan loading state.
 *
 * Requirements: 8.2, 8.5
 */
export default function StudentFormModal({
  open,
  student,
  onSubmit,
  onClose,
}: StudentFormModalProps) {
  const isEdit = Boolean(student)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: student?.full_name ?? '',
      nis: student?.nis ?? '',
      gender: student?.gender ?? undefined,
      date_of_birth: student?.date_of_birth ?? '',
      parent_name: student?.parent_name ?? '',
      parent_contact: student?.parent_contact ?? '',
    },
  })

  // Reset form saat student prop berubah (buka edit vs tambah)
  React.useEffect(() => {
    if (open) {
      reset({
        full_name: student?.full_name ?? '',
        nis: student?.nis ?? '',
        gender: student?.gender ?? undefined,
        date_of_birth: student?.date_of_birth ?? '',
        parent_name: student?.parent_name ?? '',
        parent_contact: student?.parent_contact ?? '',
      })
    }
  }, [open, student, reset])

  // Tutup dengan Escape
  React.useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Cegah scroll background
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  async function onValid(values: StudentFormValues) {
    await onSubmit(values)
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-form-title"
        className="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <h2 id="student-form-title" className="text-lg font-semibold text-foreground">
            {isEdit ? 'Edit Siswa' : 'Tambah Siswa'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onValid)} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* Nama lengkap */}
            <div className="space-y-1.5">
              <Label htmlFor="full_name">
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                placeholder="Masukkan nama lengkap"
                aria-invalid={Boolean(errors.full_name)}
                aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                {...register('full_name')}
              />
              {errors.full_name && (
                <p id="full_name-error" className="text-xs text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* NIS */}
            <div className="space-y-1.5">
              <Label htmlFor="nis">
                NIS <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nis"
                placeholder="Masukkan NIS"
                aria-invalid={Boolean(errors.nis)}
                aria-describedby={errors.nis ? 'nis-error' : undefined}
                {...register('nis')}
              />
              {errors.nis && (
                <p id="nis-error" className="text-xs text-destructive">
                  {errors.nis.message}
                </p>
              )}
            </div>

            {/* Jenis kelamin */}
            <div className="space-y-1.5">
              <Label htmlFor="gender">
                Jenis Kelamin <span className="text-destructive">*</span>
              </Label>
              <select
                id="gender"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-invalid={Boolean(errors.gender)}
                aria-describedby={errors.gender ? 'gender-error' : undefined}
                {...register('gender')}
              >
                <option value="">Pilih jenis kelamin</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
              {errors.gender && (
                <p id="gender-error" className="text-xs text-destructive">
                  {errors.gender.message}
                </p>
              )}
            </div>

            {/* Tanggal lahir */}
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">
                Tanggal Lahir <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date_of_birth"
                type="date"
                aria-invalid={Boolean(errors.date_of_birth)}
                aria-describedby={errors.date_of_birth ? 'dob-error' : undefined}
                {...register('date_of_birth')}
              />
              {errors.date_of_birth && (
                <p id="dob-error" className="text-xs text-destructive">
                  {errors.date_of_birth.message}
                </p>
              )}
            </div>

            {/* Nama orang tua */}
            <div className="space-y-1.5">
              <Label htmlFor="parent_name">Nama Orang Tua</Label>
              <Input
                id="parent_name"
                placeholder="Masukkan nama orang tua (opsional)"
                aria-invalid={Boolean(errors.parent_name)}
                aria-describedby={errors.parent_name ? 'parent_name-error' : undefined}
                {...register('parent_name')}
              />
              {errors.parent_name && (
                <p id="parent_name-error" className="text-xs text-destructive">
                  {errors.parent_name.message}
                </p>
              )}
            </div>

            {/* Kontak orang tua */}
            <div className="space-y-1.5">
              <Label htmlFor="parent_contact">Kontak Orang Tua</Label>
              <Input
                id="parent_contact"
                placeholder="Masukkan nomor telepon (opsional)"
                aria-invalid={Boolean(errors.parent_contact)}
                aria-describedby={errors.parent_contact ? 'parent_contact-error' : undefined}
                {...register('parent_contact')}
              />
              {errors.parent_contact && (
                <p id="parent_contact-error" className="text-xs text-destructive">
                  {errors.parent_contact.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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

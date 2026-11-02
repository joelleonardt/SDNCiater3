import { z } from 'zod'

// ─── Student schema ────────────────────────────────────────────────────────

export const studentSchema = z.object({
  full_name: z.string().min(1, 'Nama lengkap wajib diisi'),
  nis: z.string().min(1, 'NIS wajib diisi'),
  gender: z.enum(['Laki-laki', 'Perempuan'], {
    errorMap: () => ({ message: 'Jenis kelamin tidak valid' }),
  }),
  date_of_birth: z.string().min(1, 'Tanggal lahir wajib diisi'),
  parent_name: z.string().optional(),
  parent_contact: z.string().optional(),
})

export type StudentFormValues = z.infer<typeof studentSchema>

// ─── Class schema ──────────────────────────────────────────────────────────

export const classSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama kelas wajib diisi')
    .max(50, 'Nama kelas maksimal 50 karakter'),
  grade_level: z
    .number({ invalid_type_error: 'Tingkat kelas harus berupa angka' })
    .int()
    .min(1, 'Tingkat kelas minimal 1')
    .max(12, 'Tingkat kelas maksimal 12'),
  homeroom_teacher_id: z.string().optional(),
})

export type ClassFormValues = z.infer<typeof classSchema>

// ─── Academic year schema ──────────────────────────────────────────────────

export const academicYearSchema = z
  .object({
    name: z
      .string()
      .regex(
        /^\d{4}\/\d{4}$/,
        'Format tahun ajaran harus "YYYY/YYYY" (contoh: 2025/2026)',
      ),
  })
  .superRefine((val, ctx) => {
    const [firstStr, secondStr] = val.name.split('/')
    const first = Number(firstStr)
    const second = Number(secondStr)
    if (second !== first + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Tahun kedua harus tepat satu tahun setelah tahun pertama',
      })
    }
  })

export type AcademicYearFormValues = z.infer<typeof academicYearSchema>

// ─── Login schema ──────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

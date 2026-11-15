import { z } from 'zod'

// ─── Student schema ────────────────────────────────────────────────────────

export const studentSchema = z.object({
  full_name: z.string().min(1, 'Nama lengkap wajib diisi'),
  nis: z.string().min(1, 'NIS wajib diisi'),
  gender: z.enum(['Laki-laki', 'Perempuan'], {
    error: 'Jenis kelamin tidak valid',
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
    .number({
      error: (iss) => (iss.code === 'invalid_type' ? 'Tingkat kelas harus berupa angka' : undefined),
    })
    .int('Tingkat kelas harus bilangan bulat')
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
        code: 'custom',
        path: ['name'],
        message: 'Tahun kedua harus tepat satu tahun setelah tahun pertama',
      })
    }
  })

export type AcademicYearFormValues = z.infer<typeof academicYearSchema>

// ─── Login & Register schema ───────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Nama lengkap minimal 2 karakter')
      .max(100, 'Nama lengkap maksimal 100 karakter'),
    email: z.string().trim().email('Format email tidak valid'),
    role: z.enum(['Guru', 'Kepala_Sekolah', 'Staf_Admin'], {
      error: 'Peran tidak valid',
    }),
    password: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter')
      .max(72, 'Kata sandi maksimal 72 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

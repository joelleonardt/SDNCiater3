import { describe, it, expect, vi, afterEach } from 'vitest'
import { escapeHtml, printHTML } from '@/lib/pdfGenerator'
import {
  studentSchema,
  classSchema,
  academicYearSchema,
  loginSchema,
  registerSchema,
} from '@/lib/validators'

describe('PDF HTML escaping hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('escapes HTML special characters and handles nullish/numeric values', () => {
    expect(escapeHtml('<script>alert("xss")</script> & \'test\'')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;test&#39;',
    )
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(42)).toBe('42')
  })

  it('escapes document title inside printHTML', () => {
    const write = vi.fn()
    const close = vi.fn()
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write, close },
    } as unknown as Window)

    printHTML('<p>Konten aman</p>', 'Rapor <img src=x onerror=alert(1)>')

    expect(write).toHaveBeenCalledTimes(1)
    const html = write.mock.calls[0][0] as string
    expect(html).toContain('<title>Rapor &lt;img src=x onerror=alert(1)&gt;</title>')
    expect(close).toHaveBeenCalledTimes(1)
  })
})

describe('Zod v4 validator schemas', () => {
  it('validates studentSchema and returns expected error messages', () => {
    expect(
      studentSchema.safeParse({
        full_name: 'Anisa Putri',
        nis: '202501001',
        gender: 'Perempuan',
        date_of_birth: '2015-05-01',
      }).success,
    ).toBe(true)

    const invalidGender = studentSchema.safeParse({
      full_name: 'Anisa Putri',
      nis: '202501001',
      gender: 'Invalid',
      date_of_birth: '2015-05-01',
    })
    expect(invalidGender.success).toBe(false)
    if (!invalidGender.success) {
      expect(invalidGender.error.issues[0]?.message).toBe('Jenis kelamin tidak valid')
    }
  })

  it('validates classSchema numeric type vs range errors', () => {
    expect(classSchema.safeParse({ name: '1A', grade_level: 1 }).success).toBe(true)

    const nanGrade = classSchema.safeParse({ name: '1A', grade_level: Number.NaN })
    expect(nanGrade.success).toBe(false)
    if (!nanGrade.success) {
      expect(nanGrade.error.issues[0]?.message).toBe('Tingkat kelas harus berupa angka')
    }

    const outOfRange = classSchema.safeParse({ name: '1A', grade_level: 0 })
    expect(outOfRange.success).toBe(false)
    if (!outOfRange.success) {
      expect(outOfRange.error.issues[0]?.message).toBe('Tingkat kelas minimal 1')
    }
  })

  it('validates academicYearSchema consecutive years', () => {
    expect(academicYearSchema.safeParse({ name: '2025/2026' }).success).toBe(true)

    const gap = academicYearSchema.safeParse({ name: '2025/2027' })
    expect(gap.success).toBe(false)
    if (!gap.success) {
      expect(gap.error.issues[0]?.message).toBe(
        'Tahun kedua harus tepat satu tahun setelah tahun pertama',
      )
    }
  })

  it('validates loginSchema and registerSchema', () => {
    expect(
      loginSchema.safeParse({ email: 'guru@sekolah.id', password: 'password123' }).success,
    ).toBe(true)

    const badRole = registerSchema.safeParse({
      full_name: 'Budi Santoso',
      email: 'budi@sekolah.id',
      role: 'SuperAdmin',
      password: 'password123',
      confirmPassword: 'password123',
    })
    expect(badRole.success).toBe(false)
    if (!badRole.success) {
      expect(badRole.error.issues[0]?.message).toBe('Peran tidak valid')
    }

    const mismatch = registerSchema.safeParse({
      full_name: 'Budi Santoso',
      email: 'budi@sekolah.id',
      role: 'Guru',
      password: 'password123',
      confirmPassword: 'password456',
    })
    expect(mismatch.success).toBe(false)
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.message).toBe('Konfirmasi kata sandi tidak cocok')
    }
  })
})

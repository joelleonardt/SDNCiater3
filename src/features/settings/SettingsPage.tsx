import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Plus, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { useSettings } from './useSettings'

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const profileSchema = z.object({
  full_name: z.string().min(1, 'Nama lengkap wajib diisi').max(100, 'Maksimal 100 karakter'),
  avatar_url: z.string().url('URL tidak valid').or(z.literal('')).optional(),
})

const passwordSchema = z
  .object({
    new_password: z.string().min(8, 'Minimal 8 karakter'),
    confirm_password: z.string().min(8, 'Minimal 8 karakter'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Kata sandi tidak cocok',
    path: ['confirm_password'],
  })

const schoolSchema = z.object({
  name: z.string().min(1, 'Nama sekolah wajib diisi'),
  address: z.string().min(1, 'Alamat wajib diisi'),
  principal_name: z.string().min(1, 'Nama kepala sekolah wajib diisi'),
})

const academicYearSchema = z.object({
  name: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, 'Format harus YYYY/YYYY, contoh: 2024/2025'),
})

const gradeScalesSchema = z.object({
  scales: z.array(
    z.object({
      id: z.string().optional(),
      min_score: z.coerce
        .number({ invalid_type_error: 'Angka wajib' })
        .min(0)
        .max(100),
      max_score: z.coerce
        .number({ invalid_type_error: 'Angka wajib' })
        .min(0)
        .max(100),
      letter: z.string().min(1, 'Wajib diisi').max(3),
    }),
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>
type SchoolValues = z.infer<typeof schoolSchema>
type AcademicYearValues = z.infer<typeof academicYearSchema>
type GradeScalesValues = z.infer<typeof gradeScalesSchema>

// ─── Section: Profil Saya ─────────────────────────────────────────────────────

function ProfilSection() {
  const {
    profile,
    updateProfile,
    updatePassword,
  } = useSettings()

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? '',
      avatar_url: profile?.avatar_url ?? '',
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })

  async function handleProfileSubmit(values: ProfileValues) {
    await updateProfile({
      full_name: values.full_name,
      avatar_url: values.avatar_url || undefined,
    })
  }

  async function handlePasswordSubmit(values: PasswordValues) {
    await updatePassword(values.new_password)
    passwordForm.reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Saya</CardTitle>
        <CardDescription>Perbarui informasi profil dan kata sandi Anda</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Formulir profil */}
        <form
          onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="full_name">
              Nama Lengkap <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              {...profileForm.register('full_name')}
              placeholder="Masukkan nama lengkap"
              aria-invalid={Boolean(profileForm.formState.errors.full_name)}
              aria-describedby={profileForm.formState.errors.full_name ? 'full_name-error' : undefined}
            />
            {profileForm.formState.errors.full_name && (
              <p id="full_name-error" role="alert" className="text-xs text-destructive">
                {profileForm.formState.errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatar_url">URL Avatar (opsional)</Label>
            <Input
              id="avatar_url"
              {...profileForm.register('avatar_url')}
              placeholder="https://contoh.com/avatar.png"
              aria-invalid={Boolean(profileForm.formState.errors.avatar_url)}
              aria-describedby={profileForm.formState.errors.avatar_url ? 'avatar_url-error' : undefined}
            />
            {profileForm.formState.errors.avatar_url && (
              <p id="avatar_url-error" role="alert" className="text-xs text-destructive">
                {profileForm.formState.errors.avatar_url.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={profileForm.formState.isSubmitting}>
            {profileForm.formState.isSubmitting ? 'Menyimpan…' : 'Simpan Profil'}
          </Button>
        </form>

        <hr />

        {/* Formulir ubah kata sandi */}
        <form
          onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
          className="space-y-4"
        >
          <h3 className="text-sm font-semibold">Ubah Kata Sandi</h3>

          <div className="space-y-1.5">
            <Label htmlFor="new_password">
              Kata Sandi Baru <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="new_password"
              type="password"
              {...passwordForm.register('new_password')}
              placeholder="Minimal 8 karakter"
              aria-invalid={Boolean(passwordForm.formState.errors.new_password)}
              aria-describedby={passwordForm.formState.errors.new_password ? 'new_password-error' : undefined}
            />
            {passwordForm.formState.errors.new_password && (
              <p id="new_password-error" role="alert" className="text-xs text-destructive">
                {passwordForm.formState.errors.new_password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">
              Konfirmasi Kata Sandi <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="confirm_password"
              type="password"
              {...passwordForm.register('confirm_password')}
              placeholder="Ulangi kata sandi baru"
              aria-invalid={Boolean(passwordForm.formState.errors.confirm_password)}
              aria-describedby={passwordForm.formState.errors.confirm_password ? 'confirm_password-error' : undefined}
            />
            {passwordForm.formState.errors.confirm_password && (
              <p id="confirm_password-error" role="alert" className="text-xs text-destructive">
                {passwordForm.formState.errors.confirm_password.message}
              </p>
            )}
          </div>

          <Button type="submit" variant="outline" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? 'Menyimpan…' : 'Ubah Kata Sandi'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Section: Info Sekolah ────────────────────────────────────────────────────

function InfoSekolahSection() {
  const { school, updateSchool } = useSettings()

  const form = useForm<SchoolValues>({
    resolver: zodResolver(schoolSchema),
    values: {
      name: school?.name ?? '',
      address: school?.address ?? '',
      principal_name: school?.principal_name ?? '',
    },
  })

  async function handleSubmit(values: SchoolValues) {
    await updateSchool(values)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Info Sekolah</CardTitle>
        <CardDescription>Informasi umum tentang sekolah</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="school_name">
              Nama Sekolah <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="school_name"
              {...form.register('name')}
              placeholder="Masukkan nama sekolah"
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? 'school_name-error' : undefined}
            />
            {form.formState.errors.name && (
              <p id="school_name-error" role="alert" className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="school_address">
              Alamat <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="school_address"
              {...form.register('address')}
              placeholder="Masukkan alamat sekolah"
              aria-invalid={Boolean(form.formState.errors.address)}
              aria-describedby={form.formState.errors.address ? 'school_address-error' : undefined}
            />
            {form.formState.errors.address && (
              <p id="school_address-error" role="alert" className="text-xs text-destructive">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="principal_name">
              Nama Kepala Sekolah <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="principal_name"
              {...form.register('principal_name')}
              placeholder="Masukkan nama kepala sekolah"
              aria-invalid={Boolean(form.formState.errors.principal_name)}
              aria-describedby={form.formState.errors.principal_name ? 'principal_name-error' : undefined}
            />
            {form.formState.errors.principal_name && (
              <p id="principal_name-error" role="alert" className="text-xs text-destructive">
                {form.formState.errors.principal_name.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan Info Sekolah'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Section: Tahun Ajaran ────────────────────────────────────────────────────

function TahunAjaranSection() {
  const { academicYears, createAcademicYear, setActiveAcademicYear } = useSettings()
  const [activating, setActivating] = React.useState<string | null>(null)

  const form = useForm<AcademicYearValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: { name: '' },
  })

  async function handleCreate(values: AcademicYearValues) {
    await createAcademicYear(values.name)
    form.reset()
  }

  async function handleActivate(id: string) {
    setActivating(id)
    try {
      await setActiveAcademicYear(id)
    } finally {
      setActivating(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tahun Ajaran</CardTitle>
        <CardDescription>Kelola dan aktifkan tahun ajaran</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daftar tahun ajaran */}
        {academicYears.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tahun ajaran.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {academicYears.map((year) => (
              <li
                key={year.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  {year.is_active && (
                    <CheckCircle
                      className="h-4 w-4 text-green-500"
                      aria-label="Aktif"
                    />
                  )}
                  <span className={year.is_active ? 'font-semibold' : ''}>
                    {year.name}
                  </span>
                  {year.is_active && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Aktif
                    </span>
                  )}
                </div>
                {!year.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activating === year.id}
                    onClick={() => handleActivate(year.id)}
                  >
                    {activating === year.id ? 'Mengaktifkan…' : 'Aktifkan'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Form tambah tahun ajaran */}
        <form
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex items-start gap-2"
        >
          <div className="flex-1 space-y-1">
            <Input
              {...form.register('name')}
              placeholder="Contoh: 2024/2025"
              aria-label="Nama tahun ajaran"
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? 'academic-year-name-error' : undefined}
            />
            {form.formState.errors.name && (
              <p id="academic-year-name-error" role="alert" className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {form.formState.isSubmitting ? 'Menambahkan…' : 'Tambah Tahun Ajaran'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Section: Skala Nilai ─────────────────────────────────────────────────────

function SkalaNilaiSection() {
  const { gradeScales, saveGradeScales } = useSettings()

  const form = useForm<GradeScalesValues>({
    resolver: zodResolver(gradeScalesSchema),
    values: {
      scales: gradeScales.map((s) => ({
        id: s.id,
        min_score: s.min_score,
        max_score: s.max_score,
        letter: s.letter,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'scales',
  })

  async function handleSubmit(values: GradeScalesValues) {
    await saveGradeScales(
      values.scales.map((s) => ({
        min_score: s.min_score,
        max_score: s.max_score,
        letter: s.letter,
      })),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skala Nilai</CardTitle>
        <CardDescription>
          Tentukan rentang skor dan huruf nilai sekolah
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Header tabel */}
          {fields.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_1fr_2.5rem] gap-2 text-xs font-medium text-muted-foreground">
              <span>Nilai Min</span>
              <span>Nilai Maks</span>
              <span>Huruf</span>
              <span />
            </div>
          )}

          {/* Baris skala nilai */}
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_1fr_1fr_2.5rem] items-start gap-2"
            >
              <div className="space-y-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...form.register(`scales.${index}.min_score`)}
                  placeholder="0"
                  aria-label={`Nilai minimum baris ${index + 1}`}
                  aria-invalid={Boolean(form.formState.errors.scales?.[index]?.min_score)}
                  aria-describedby={form.formState.errors.scales?.[index]?.min_score ? `scale-min-${index}-error` : undefined}
                />
                {form.formState.errors.scales?.[index]?.min_score && (
                  <p id={`scale-min-${index}-error`} role="alert" className="text-xs text-destructive">
                    {form.formState.errors.scales[index]?.min_score?.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...form.register(`scales.${index}.max_score`)}
                  placeholder="100"
                  aria-label={`Nilai maksimum baris ${index + 1}`}
                  aria-invalid={Boolean(form.formState.errors.scales?.[index]?.max_score)}
                  aria-describedby={form.formState.errors.scales?.[index]?.max_score ? `scale-max-${index}-error` : undefined}
                />
                {form.formState.errors.scales?.[index]?.max_score && (
                  <p id={`scale-max-${index}-error`} role="alert" className="text-xs text-destructive">
                    {form.formState.errors.scales[index]?.max_score?.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Input
                  {...form.register(`scales.${index}.letter`)}
                  placeholder="A"
                  aria-label={`Huruf nilai baris ${index + 1}`}
                  aria-invalid={Boolean(form.formState.errors.scales?.[index]?.letter)}
                  aria-describedby={form.formState.errors.scales?.[index]?.letter ? `scale-letter-${index}-error` : undefined}
                />
                {form.formState.errors.scales?.[index]?.letter && (
                  <p id={`scale-letter-${index}-error`} role="alert" className="text-xs text-destructive">
                    {form.formState.errors.scales[index]?.letter?.message}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 text-destructive hover:text-destructive"
                onClick={() => remove(index)}
                aria-label={`Hapus baris ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Belum ada skala nilai. Klik "Tambah Baris" untuk memulai.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ min_score: 0, max_score: 100, letter: '' })}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Tambah Baris
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan Skala Nilai'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

/**
 * Halaman pengaturan.
 * - Semua peran: Profil Saya
 * - Kepala_Sekolah & Staf_Admin: + Info Sekolah, Tahun Ajaran, Skala Nilai
 * Requirements: 13.1–13.6
 */
export default function SettingsPage() {
  const profile = useAuthStore((s) => s.profile)
  const isAdmin =
    profile?.role === 'Kepala_Sekolah' || profile?.role === 'Staf_Admin'

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pengaturan"
        description="Kelola profil, informasi sekolah, dan konfigurasi sistem"
      />

      <div className="space-y-6">
        <ProfilSection />
        {isAdmin && (
          <>
            <InfoSekolahSection />
            <TahunAjaranSection />
            <SkalaNilaiSection />
          </>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { updatePassword } from '@/services/authService'
import type { ServiceError } from '@/services/authService'

// Requirement 2.4: kata sandi baru minimal 8 karakter
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Kata sandi baru minimal 8 karakter'),
    confirmPassword: z
      .string()
      .min(1, 'Konfirmasi kata sandi wajib diisi'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok',
    path: ['confirmPassword'],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  // Requirement 2.11: cek apakah hash dari link reset ada (link kadaluarsa / sudah dipakai)
  // Supabase menggunakan fragment (#access_token=...) yang diparse oleh Supabase JS secara otomatis.
  // Jika tidak ada hash, tandai link sebagai tidak valid.
  const hasResetToken =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token') ||
      window.location.search.includes('code=') ||
      // Supabase v2 PKCE flow menggunakan ?code= di URL
      window.location.hash.includes('type=recovery'))

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const {
    formState: { isSubmitting },
  } = form

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null)
    try {
      // Requirement 2.4: perbarui kata sandi via Supabase Auth
      await updatePassword(values.password)
      // Requirement 2.4: redirect ke halaman login setelah sukses
      navigate('/login', { replace: true })
    } catch (err) {
      const serviceError = err as ServiceError
      setServerError(serviceError.userMessage ?? 'Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  // Requirement 2.11: tampilkan pesan error jika link tidak valid / kadaluarsa
  if (!hasResetToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Tautan Tidak Valid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-4 text-sm text-destructive"
            >
              Tautan reset kata sandi ini sudah tidak berlaku atau telah
              digunakan sebelumnya. Silakan minta tautan baru.
            </p>
            <div className="text-center text-sm">
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                Minta tautan reset baru
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Atur Ulang Kata Sandi</CardTitle>
          <CardDescription>
            Masukkan kata sandi baru Anda di bawah ini
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kata Sandi Baru</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Minimal 8 karakter"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Kata Sandi</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Ulangi kata sandi baru"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <p
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm">
            <Link
              to="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              &larr; Kembali ke halaman masuk
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

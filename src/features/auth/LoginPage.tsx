import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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

import { loginSchema, type LoginFormValues } from '@/lib/validators'
import { signIn } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import type { ServiceError } from '@/services/authService'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAuthStore((s) => s.session)
  const [serverError, setServerError] = useState<string | null>(null)

  // Requirement 2.8: Pesan dari redirect sesi kadaluarsa (dikirim via location.state)
  const stateMessage = (location.state as { message?: string } | null)?.message ?? null

  // Requirement 2.6: redirect ke dashboard jika sudah terautentikasi
  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true })
    }
  }, [session, navigate])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const {
    formState: { isSubmitting },
  } = form

  async function onSubmit(values: LoginFormValues) {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
      // authStore.initializeAuth() akan menangani pembaruan state via onAuthStateChange
      // navigasi ke /dashboard akan terjadi melalui useEffect di atas
    } catch (err) {
      const serviceError = err as ServiceError
      // Requirement 2.2: tampilkan pesan error Bahasa Indonesia dalam 3 detik
      setServerError(serviceError.userMessage ?? 'Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Sekolah Admin</CardTitle>
          <CardDescription>
            Masuk ke akun Anda untuk melanjutkan
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Requirement 2.8: Banner notifikasi sesi kadaluarsa dalam Bahasa Indonesia */}
          {stateMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
            >
              {stateMessage}
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="guru@sekolah.sch.id"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kata Sandi</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Requirement 2.2: pesan error server dalam Bahasa Indonesia */}
              {serverError && (
                <p
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {serverError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Masuk'}
              </Button>
            </form>
          </Form>

          {/* Requirement 2.3: link ke halaman lupa kata sandi */}
          <div className="mt-4 text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              Lupa Kata Sandi?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

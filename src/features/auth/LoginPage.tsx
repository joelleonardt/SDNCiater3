import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [showPassword, setShowPassword] = useState(false)

  const stateMessage = (location.state as { message?: string } | null)?.message ?? null

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const { formState: { isSubmitting } } = form

  async function onSubmit(values: LoginFormValues) {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
    } catch (err) {
      const e = err as ServiceError
      setServerError(e.userMessage ?? 'Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary px-12 text-primary-foreground">
        <GraduationCap className="h-20 w-20 mb-6 opacity-90" />
        <h1 className="text-4xl font-bold mb-3 text-center">Sekolah Admin</h1>
        <p className="text-lg opacity-75 text-center max-w-xs leading-relaxed">
          Sistem manajemen administrasi sekolah terpadu untuk Indonesia
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-xs">
          {[
            { label: 'Manajemen Kelas', icon: '🏫' },
            { label: 'Absensi Siswa', icon: '📋' },
            { label: 'Input Nilai', icon: '📊' },
            { label: 'Laporan PDF', icon: '📄' },
          ].map((f) => (
            <div key={f.label} className="bg-white/10 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-xs opacity-80 font-medium">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <GraduationCap className="h-12 w-12 text-primary mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Sekolah Admin</h1>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Selamat datang</h2>
            <p className="text-muted-foreground mt-1">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          {/* Session expired banner */}
          {stateMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              {stateMessage}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
                        className="h-11"
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Kata Sandi</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary hover:underline"
                      >
                        Lupa kata sandi?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="h-11 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        >
                          {showPassword
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />
                          }
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <div
                  role="alert"
                  className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive"
                >
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting}>
                {isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>
                  : 'Masuk'
                }
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}

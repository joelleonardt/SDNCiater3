import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Building2,
  Lock,
} from 'lucide-react'

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

import {
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '@/lib/validators'
import { signIn, signUp } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import type { ServiceError } from '@/services/authService'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAuthStore((s) => s.session)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const stateMessage = (location.state as { message?: string } | null)?.message ?? null

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'Guru',
      password: '',
      confirmPassword: '',
    },
  })

  const isLoginSubmitting = loginForm.formState.isSubmitting
  const isRegisterSubmitting = registerForm.formState.isSubmitting

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode)
    setServerError(null)
    setSuccessMessage(null)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  async function onLoginSubmit(values: LoginFormValues) {
    setServerError(null)
    setSuccessMessage(null)
    try {
      await signIn(values.email, values.password)
    } catch (err) {
      const e = err as ServiceError
      setServerError(e.userMessage ?? 'Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  async function onRegisterSubmit(values: RegisterFormValues) {
    setServerError(null)
    setSuccessMessage(null)
    try {
      const result = await signUp(
        values.full_name,
        values.email,
        values.password,
        values.role
      )
      if (result.data.session) {
        navigate('/dashboard', { replace: true })
        return
      }
      registerForm.reset()
      loginForm.setValue('email', values.email)
      setMode('login')
      setSuccessMessage(
        'Akun berhasil dibuat! Silakan masuk dan hubungi Staf Admin untuk verifikasi akun Anda melalui Dashboard Admin.'
      )
    } catch (err) {
      const e = err as ServiceError
      setServerError(e.userMessage ?? 'Gagal membuat akun baru. Silakan coba lagi.')
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-background px-4 py-6 sm:px-6 sm:py-8">
      {/* Subtle architectural grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,#000_70%,transparent_100%)]"
      />

      {/* Top institutional header bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary shadow-sm">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="block text-sm font-semibold tracking-tight text-foreground">
              SDN Ciater 3
            </span>
            <span className="block text-xs text-muted-foreground">
              Sistem Administrasi Sekolah
            </span>
          </div>
        </div>

        <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Portal Internal Guru &amp; Staf
        </div>
      </header>

      {/* Center portal container */}
      <main className="relative z-10 mx-auto my-8 w-full max-w-[420px]">
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          {/* Card header */}
          <div className="border-b border-border/70 px-6 pt-6 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Portal Akademik &amp; Administrasi
            </p>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
              {mode === 'login' ? 'Masuk ke SDN Ciater 3' : 'Registrasi Akun Pegawai'}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {mode === 'login'
                ? 'Gunakan email terdaftar untuk mengelola kelas, presensi, nilai, dan rapor siswa.'
                : 'Daftarkan akun guru atau staf baru untuk dihubungkan ke sistem SDN Ciater 3.'}
            </p>
          </div>

          {/* Card body */}
          <div className="px-6 py-6">
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

            {/* Registration success banner */}
            {successMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                {successMessage}
              </div>
            )}

            {mode === 'login' ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4" noValidate>
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="guru@sekolah.sch.id"
                            autoComplete="email"
                            className="h-10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
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
                              className="h-10 pr-10"
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

                  <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={isLoginSubmitting}>
                    {isLoginSubmitting
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>
                      : 'Masuk'
                    }
                  </Button>

                  <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-semibold text-primary hover:underline"
                    >
                      Buat akun baru
                    </button>
                  </div>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4" noValidate>
                  <FormField
                    control={registerForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Budi Santoso, S.Pd."
                            autoComplete="name"
                            className="h-10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="guru@sekolah.sch.id"
                            autoComplete="email"
                            className="h-10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pengajuan Peran</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={field.value}
                            onChange={field.onChange}
                          >
                            <option value="Guru">Guru (Langsung Aktif)</option>
                            <option value="Staf_Admin">Staf Admin (Perlu Verifikasi Dashboard Admin)</option>
                            <option value="Kepala_Sekolah">Kepala Sekolah (Perlu Verifikasi Dashboard Admin)</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kata Sandi</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Minimal 8 karakter"
                              autoComplete="new-password"
                              className="h-10 pr-10"
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

                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Konfirmasi Kata Sandi</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Ulangi kata sandi"
                              autoComplete="new-password"
                              className="h-10 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'}
                            >
                              {showConfirmPassword
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

                  <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      Akun baru menunggu verifikasi <strong>Staf Admin</strong> (kecuali akun pertama sistem otomatis menjadi <strong>Staf Admin</strong>). Penetapan atau perubahan peran (<strong>Guru</strong>, <strong>Staf Admin</strong>, atau <strong>Kepala Sekolah</strong>) akan diverifikasi melalui <strong>Dashboard Admin</strong>.
                    </span>
                  </div>

                  {serverError && (
                    <div
                      role="alert"
                      className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive"
                    >
                      {serverError}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={isRegisterSubmitting}>
                    {isRegisterSubmitting
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mendaftarkan...</>
                      : 'Daftar Akun Baru'
                    }
                  </Button>

                  <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
                    Sudah punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-semibold text-primary hover:underline"
                    >
                      Masuk di sini
                    </button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </div>

        {/* Institutional info bar */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-card/80 p-3 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <div className="font-medium text-foreground">SD Negeri Ciater 3</div>
              <div className="text-[11px] text-muted-foreground">Kelas • Presensi • Nilai • Rapor</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 border-l border-border/70 pl-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <div className="font-medium text-foreground">Akses Terverifikasi</div>
              <div className="text-[11px] text-muted-foreground">Guru, Staf Admin &amp; Kepala Sekolah</div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom footer */}
      <footer className="relative z-10 mx-auto w-full max-w-5xl text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} SDN Ciater 3 — Sistem Administrasi Sekolah
      </footer>
    </div>
  )
}

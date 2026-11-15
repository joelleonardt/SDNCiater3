import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GraduationCap, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

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

      {/* Right panel — login / register form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <GraduationCap className="h-12 w-12 text-primary mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Sekolah Admin</h1>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === 'login' ? 'Selamat datang' : 'Buat akun baru'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {mode === 'login'
                ? 'Masuk ke akun Anda untuk melanjutkan'
                : 'Daftarkan akun untuk mengakses Sekolah Admin'}
            </p>
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
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5" noValidate>
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
                          className="h-11"
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

                <Button type="submit" className="w-full h-11 text-base" disabled={isLoginSubmitting}>
                  {isLoginSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>
                    : 'Masuk'
                  }
                </Button>

                <div className="pt-2 text-center text-sm text-muted-foreground">
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
                          className="h-11"
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
                          className="h-11"
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
                          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                            className="h-11 pr-10"
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

                <Button type="submit" className="w-full h-11 text-base" disabled={isRegisterSubmitting}>
                  {isRegisterSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mendaftarkan...</>
                    : 'Daftar Akun Baru'
                  }
                </Button>

                <div className="pt-2 text-center text-sm text-muted-foreground">
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
    </div>
  )
}

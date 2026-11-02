import { useState } from 'react'
import { Link } from 'react-router-dom'
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

import { sendPasswordReset } from '@/services/authService'
import type { ServiceError } from '@/services/authService'

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const {
    formState: { isSubmitting },
  } = form

  async function onSubmit(values: ForgotPasswordFormValues) {
    setServerError(null)
    try {
      // Requirement 2.3: kirim email reset kata sandi via Supabase Auth dalam 5 detik
      await sendPasswordReset(values.email)
      setIsSuccess(true)
    } catch (err) {
      const serviceError = err as ServiceError
      setServerError(serviceError.userMessage ?? 'Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Lupa Kata Sandi</CardTitle>
          <CardDescription>
            Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur
            ulang kata sandi
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isSuccess ? (
            /* Requirement 2.3: pesan sukses dalam Bahasa Indonesia */
            <div className="space-y-4">
              <div
                role="status"
                className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
              >
                Email reset kata sandi telah dikirim. Silakan periksa kotak
                masuk Anda.
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Tidak menerima email?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSuccess(false)
                    form.reset()
                  }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Kirim ulang
                </button>
              </p>
            </div>
          ) : (
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
                  {isSubmitting ? 'Mengirim...' : 'Kirim Tautan Reset'}
                </Button>
              </form>
            </Form>
          )}

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

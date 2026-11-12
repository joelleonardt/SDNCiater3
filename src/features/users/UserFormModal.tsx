import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Profile } from '@/types/database.types'
import type { Role } from '@/services/userService'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface UserFormModalProps {
  user?: Profile | null
  onClose: () => void
  onSave?: (userId: string, role: Role) => Promise<unknown>
  onCreate?: (payload: { full_name: string; email: string; password: string; role: Role }) => Promise<unknown>
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'Guru', label: 'Guru' },
  { value: 'Kepala_Sekolah', label: 'Kepala Sekolah' },
  { value: 'Staf_Admin', label: 'Staf Admin' },
]

/**
 * Modal tambah/edit pengguna.
 * - Mode Edit: Hanya peran yang dapat diubah (Req 12.6).
 * - Mode Tambah: Input Nama Lengkap (1-100), Email (max 254), Password (min 8), dan Peran (Req 12.3-12.5).
 */
export default function UserFormModal({ user, onClose, onSave, onCreate }: UserFormModalProps) {
  const isEdit = !!user

  // Form states
  const [role, setRole] = React.useState<Role>(user?.role ?? 'Guru')
  const [fullName, setFullName] = React.useState(user?.full_name ?? '')
  const [email, setEmail] = React.useState(user?.email ?? '')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Tutup saat Escape
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Cegah scroll background
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Validasi form tambah
  const canSubmitCreate =
    fullName.trim().length >= 1 &&
    fullName.trim().length <= 100 &&
    email.trim().length > 0 &&
    email.trim().length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (isEdit) {
        if (onSave && user) {
          await onSave(user.id, role)
        }
      } else {
        if (!fullName.trim() || fullName.trim().length > 100) {
          setError('Nama lengkap harus antara 1 sampai 100 karakter.')
          setIsSubmitting(false)
          return
        }
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError('Format email tidak valid.')
          setIsSubmitting(false)
          return
        }
        if (password.length < 8) {
          setError('Kata sandi minimal 8 karakter.')
          setIsSubmitting(false)
          return
        }

        if (onCreate) {
          await onCreate({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            role,
          })
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses data pengguna.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
        className={cn(
          'w-full max-w-md rounded-lg border border-border bg-background shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <h2 id="user-form-title" className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {isEdit ? (
              <>
                {/* Nama lengkap — read-only */}
                <div className="space-y-1.5">
                  <Label>Nama Lengkap</Label>
                  <p className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground">
                    {user?.full_name}
                  </p>
                </div>

                {/* Email — read-only jika ada */}
                {user?.email && (
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <p className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground">
                      {user.email}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Nama Lengkap Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-full-name">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Budi Raharjo, S.Pd."
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>

                {/* Email Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@sekolah.sch.id"
                    maxLength={254}
                    required
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-password">
                    Kata Sandi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    minLength={8}
                    required
                  />
                </div>
              </>
            )}

            {/* Peran */}
            <div className="space-y-1.5">
              <Label htmlFor="user-role">
                Peran <span className="text-destructive">*</span>
              </Label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!isEdit && !canSubmitCreate)}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Menyimpan…
                </span>
              ) : (
                'Simpan'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

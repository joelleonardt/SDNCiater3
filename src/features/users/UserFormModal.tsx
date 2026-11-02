import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Profile } from '@/types/database.types'

type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface UserFormModalProps {
  user: Profile
  onClose: () => void
  onSave: (userId: string, role: Role) => Promise<void>
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'Guru', label: 'Guru' },
  { value: 'Kepala_Sekolah', label: 'Kepala Sekolah' },
  { value: 'Staf_Admin', label: 'Staf Admin' },
]

/**
 * Modal edit peran pengguna.
 * - Nama lengkap hanya tampil (read-only)
 * - Peran dapat diubah via select
 * Requirements: 12.3, 12.4
 */
export default function UserFormModal({ user, onClose, onSave }: UserFormModalProps) {
  const [role, setRole] = React.useState<Role>(user.role)
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
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSave(user.id, role)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
            Edit Pengguna
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* Nama lengkap — read-only */}
            <div className="space-y-1.5">
              <Label>Nama Lengkap</Label>
              <p className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground">
                {user.full_name}
              </p>
            </div>

            {/* Peran */}
            <div className="space-y-1.5">
              <Label htmlFor="user-role">Peran</Label>
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
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
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

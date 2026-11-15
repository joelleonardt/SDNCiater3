import { useEffect, useState } from 'react'
import { ShieldCheck, Check, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Role } from '@/services/userService'
import type { Profile } from '@/types/database.types'

const ROLE_LABELS: Record<Role, string> = {
  Guru: 'Guru',
  Kepala_Sekolah: 'Kepala Sekolah',
  Staf_Admin: 'Staf Admin',
}

interface PendingVerificationListProps {
  users: Profile[]
  canManage: boolean
  loading?: boolean
  error?: string | null
  showWhenEmpty?: boolean
  onReload?: () => void
  onApprove: (user: Profile, approvedRole: Role) => Promise<unknown>
  onReject: (user: Profile) => Promise<unknown>
}

export default function PendingVerificationList({
  users,
  canManage,
  loading = false,
  error = null,
  showWhenEmpty = false,
  onReload,
  onApprove,
  onReject,
}: PendingVerificationListProps) {
  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedRoles((prev) => {
      const next: Record<string, Role> = {}
      for (const u of users) {
        next[u.id] = prev[u.id] ?? u.requested_role ?? u.role
      }
      return next
    })
  }, [users])

  const hasPending = users.length > 0
  if (!hasPending && !showWhenEmpty && !error) {
    return null
  }

  async function handleApprove(user: Profile) {
    const approvedRole: Role = selectedRoles[user.id] ?? user.requested_role ?? user.role
    setBusyId(user.id)
    try {
      await onApprove(user, approvedRole)
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(user: Profile) {
    setBusyId(user.id)
    try {
      await onReject(user)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      role="region"
      aria-label="Verifikasi akun dan perubahan peran pengguna"
      className={cn(
        'rounded-xl border p-4',
        hasPending
          ? 'border-amber-300 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-950/30'
          : 'border-border bg-card'
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className={cn(
            'flex items-center gap-2 text-sm font-semibold',
            hasPending ? 'text-amber-900 dark:text-amber-200' : 'text-foreground'
          )}
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Verifikasi Akun &amp; Perubahan Peran
            {hasPending ? ` (${users.length})` : ''}
          </span>
        </div>
        {onReload && (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={onReload}
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Memuat...' : 'Muat Ulang'}
          </Button>
        )}
      </div>

      {error ? (
        <p className="text-xs text-destructive">
          {error} — Pastikan script SQL terbaru di supabase/sync_existing_db.sql sudah dijalankan di Supabase SQL Editor.
        </p>
      ) : !hasPending ? (
        <p className="text-xs text-muted-foreground">
          {loading
            ? 'Memeriksa akun baru dan pengajuan perubahan peran...'
            : 'Belum ada akun baru atau pengajuan perubahan peran yang menunggu verifikasi.'}
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isNewAccount = !u.school_id
            const selectedRole: Role = selectedRoles[u.id] ?? u.requested_role ?? u.role
            const requestedLabel = u.requested_role ? ROLE_LABELS[u.requested_role] : ROLE_LABELS[u.role]
            const isBusy = busyId === u.id
            return (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-lg border bg-background p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.full_name}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({u.email ?? 'tanpa email'})
                      </span>
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                        isNewAccount
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      )}
                    >
                      {isNewAccount ? 'Akun Baru' : 'Ubah Peran'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isNewAccount ? (
                      <>
                        Belum terhubung ke sekolah &bull; Mengajukan peran:{' '}
                        <strong className="text-primary">{requestedLabel}</strong>
                      </>
                    ) : (
                      <>
                        Peran saat ini: <strong>{ROLE_LABELS[u.role]}</strong> &rarr; Mengajukan:{' '}
                        <strong className="text-primary">{requestedLabel}</strong>
                      </>
                    )}
                  </p>
                </div>

                {canManage && (
                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    <select
                      aria-label={`Pilih peran untuk ${u.full_name}`}
                      value={selectedRole}
                      disabled={isBusy}
                      onChange={(e) =>
                        setSelectedRoles((prev) => ({
                          ...prev,
                          [u.id]: e.target.value as Role,
                        }))
                      }
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                    >
                      <option value="Guru">Guru</option>
                      <option value="Kepala_Sekolah">Kepala Sekolah</option>
                      <option value="Staf_Admin">Staf Admin</option>
                    </select>
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void handleApprove(u)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      {isNewAccount ? 'Verifikasi & Setujui' : 'Setujui'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => void handleReject(u)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Tolak
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'

/**
 * Halaman 403 — ditampilkan ketika pengguna mencoba mengakses halaman
 * yang tidak diizinkan berdasarkan perannya.
 *
 * Requirements: 3.7
 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="text-center">
        <p className="text-8xl font-extrabold text-destructive">403</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Akses Ditolak</h1>
        <p className="mt-2 text-muted-foreground">
          Anda tidak memiliki akses ke halaman ini.
        </p>
      </div>

      <Link
        to="/dashboard"
        className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  )
}

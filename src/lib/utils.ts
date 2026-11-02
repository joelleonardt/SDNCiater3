import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Indonesian month names ────────────────────────────────────────────────

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Format a date as "dd MMMM yyyy" in Indonesian locale.
 * Example: "01 Januari 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dd = String(d.getDate()).padStart(2, '0')
  const mmmm = BULAN_ID[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd} ${mmmm} ${yyyy}`
}

/**
 * Alias of formatDate, intended for use in printed reports.
 */
export function formatReportDate(date: Date): string {
  return formatDate(date)
}

/**
 * Parse a string in "dd MMMM yyyy" Indonesian format back to a Date.
 * Example: "01 Januari 2026" → new Date(2026, 0, 1)
 */
export function parseReportDate(str: string): Date {
  const parts = str.trim().split(' ')
  if (parts.length !== 3) {
    throw new Error(`parseReportDate: invalid format "${str}"`)
  }
  const [ddStr, mmmmStr, yyyyStr] = parts
  const monthIndex = BULAN_ID.findIndex(
    (m) => m.toLowerCase() === mmmmStr.toLowerCase(),
  )
  if (monthIndex === -1) {
    throw new Error(`parseReportDate: unknown month "${mmmmStr}"`)
  }
  return new Date(Number(yyyyStr), monthIndex, Number(ddStr))
}

/**
 * Format a number with dot as thousands separator.
 * Example: 1000 → "1.000", 1500000 → "1.500.000"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('id-ID')
}

/**
 * Trim seconds from a "HH:MM:SS" time string.
 * Example: "08:30:00" → "08:30"
 */
export function formatTime(time: string): string {
  return time.slice(0, 5)
}

/**
 * Calculate attendance percentage rounded to 1 decimal place.
 * Returns 0 if total is 0 to avoid division by zero.
 */
export function calculateAttendancePercentage(
  hadir: number,
  total: number,
): number {
  if (total === 0) return 0
  return Math.round((hadir / total) * 1000) / 10
}

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
export function formatReportDate(date: Date | string): string {
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
 * Format a number with Indonesian locale (dot as thousands separator, comma as decimal separator).
 * Example: 1000 → "1.000", 1500000 → "1.500.000"
 */
export function formatNumber(n: number, maxDecimals?: number): string {
  if (maxDecimals !== undefined) {
    return n.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    })
  }
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

/**
 * Convert numeric final score (0–100) to letter grade based on school's grade_scales.
 * Returns 'N/A' if scales are empty or no matching range is found (Req 10.6, 10.7).
 */
export function scoreToLetter(
  score: number,
  scales: Array<{ min_score: number; max_score: number; letter: string }>,
): string {
  if (!scales || scales.length === 0) return 'N/A'
  const rounded = Math.round(score)
  for (const s of scales) {
    if (
      (score >= s.min_score && score <= s.max_score) ||
      (rounded >= s.min_score && rounded <= s.max_score)
    ) {
      return s.letter
    }
  }
  return 'N/A'
}

/**
 * Ekstrak pesan error yang terbaca dari Error, PostgrestError, atau objek serupa.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    (err as { message: string }).message
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

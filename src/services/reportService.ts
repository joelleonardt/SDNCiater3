/**
 * reportService.ts — generate laporan PDF untuk kehadiran dan rapor siswa.
 * Requirements: 11.1–11.7
 */

import { getAttendanceRecap } from './attendanceService'
import { getStudentAttendanceSummary } from './studentService'
import { getGradeScales } from './settingsService'
import { supabase } from './supabase'
import { printHTML } from '@/lib/pdfGenerator'
import { formatReportDate, formatNumber, scoreToLetter } from '@/lib/utils'
import type { Student } from '@/types/database.types'

const PDF_TIMEOUT_MS = 10_000

async function withTimeout<T>(promise: Promise<T>, timeoutMs = PDF_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          'Pembuatan PDF melampaui batas waktu 10 detik. Silakan coba lagi atau persempit rentang data.'
        )
      )
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Ambil daftar siswa aktif di sebuah kelas untuk kebutuhan halaman Laporan (Req 16.3).
 */
export async function getStudentsByClass(classId: string): Promise<Student[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('class_students')
    .select('students(*)')
    .eq('class_id', classId)

  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((row) => row.students as Student | null)
    .filter((s): s is Student => Boolean(s && !s.is_deleted))
}

// ─── Laporan Kehadiran ────────────────────────────────────────────────────────

/**
 * Generate laporan kehadiran kelas dalam rentang tanggal sebagai PDF cetak.
 * Requirements: 11.1, 11.3, 11.4, 11.5, 11.6, 11.7
 */
export async function generateAttendancePdf(
  classId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const [recap, classRes] = await withTimeout(
    Promise.all([
      getAttendanceRecap(classId, startDate, endDate),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('classes')
        .select('name, schools(name)')
        .eq('id', classId)
        .maybeSingle(),
    ])
  )

  if (recap.length === 0) {
    throw new Error('Tidak ada data kehadiran untuk kelas dan rentang tanggal yang dipilih.')
  }

  const className = classRes.data?.name ?? '—'
  const schoolName = classRes.data?.schools?.name ?? 'Sekolah'

  const rows = recap
    .map(
      (r, i) => `
      <tr>
        <td style="text-align:center">${formatNumber(i + 1)}</td>
        <td>${r.full_name}</td>
        <td style="text-align:center">${formatNumber(r.hadir)}</td>
        <td style="text-align:center">${formatNumber(r.sakit)}</td>
        <td style="text-align:center">${formatNumber(r.izin)}</td>
        <td style="text-align:center">${formatNumber(r.alfa ?? r.alpa)}</td>
        <td style="text-align:center">${formatNumber(r.total)}</td>
        <td style="text-align:center">${formatNumber(r.persentase_hadir, 1)}%</td>
      </tr>`
    )
    .join('')

  const html = `
    <h1>${schoolName} — Laporan Kehadiran Siswa</h1>
    <p class="meta">Kelas: ${className} | Periode: ${formatReportDate(startDate)} s/d ${formatReportDate(endDate)}</p>
    <table>
      <thead>
        <tr>
          <th style="width:30px">No</th>
          <th>Nama Siswa</th>
          <th style="width:50px">Hadir</th>
          <th style="width:50px">Sakit</th>
          <th style="width:50px">Izin</th>
          <th style="width:50px">Alfa</th>
          <th style="width:50px">Total</th>
          <th style="width:70px">% Hadir</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="meta" style="margin-top:16px">Jumlah siswa: ${formatNumber(recap.length)} | Dicetak pada: ${formatReportDate(new Date())}</p>
  `

  printHTML(html, 'Laporan Kehadiran')
}

// ─── Rapor Siswa ──────────────────────────────────────────────────────────────

interface GradeRow {
  component_name: string
  weight: number
  score: number
}

/**
 * Generate rapor siswa untuk semester tertentu sebagai PDF cetak.
 * Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */
export async function generateReportCardPdf(
  studentId: string,
  semesterId: string
): Promise<void> {
  const [studentRes, gradeRes, semesterRes, attendanceSummary] = await withTimeout(
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('students')
        .select('full_name, nis, school_id, schools(name, address, principal_name), class_students(classes(name, profiles(full_name)))')
        .eq('id', studentId)
        .single(),
      supabase
        .from('grades')
        .select('score, grade_components(name, weight, semester_id)')
        .eq('student_id', studentId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('semesters')
        .select('name, academic_years(name)')
        .eq('id', semesterId)
        .maybeSingle(),
      getStudentAttendanceSummary(studentId),
    ])
  )

  if (studentRes.error) throw new Error(studentRes.error.message)
  if (gradeRes.error) throw new Error(gradeRes.error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = studentRes.data as any

  // Normalkan hasil — filter baris yang semester_id cocok
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grades: GradeRow[] = ((gradeRes.data ?? []) as any[])
    .filter((g) => g.grade_components && g.grade_components.semester_id === semesterId)
    .map((g) => ({
      component_name: g.grade_components.name as string,
      weight: g.grade_components.weight as number,
      score: g.score as number,
    }))

  if (grades.length === 0) {
    throw new Error('Belum ada data nilai untuk siswa pada semester yang dipilih.')
  }

  const gradeScales = student.school_id
    ? await withTimeout(getGradeScales(student.school_id))
    : []

  // Hitung nilai akhir (rata-rata berbobot, 2 desimal)
  const totalWeight = grades.reduce((s, g) => s + g.weight, 0)
  const nilaiAkhir =
    totalWeight > 0
      ? Math.round((grades.reduce((s, g) => s + g.score * g.weight, 0) / totalWeight) * 100) / 100
      : 0
  const hurufAkhir = scoreToLetter(nilaiAkhir, gradeScales)

  const schoolName = student.schools?.name ?? 'Sekolah'
  const schoolAddress = student.schools?.address ?? ''
  const principalName = student.schools?.principal_name ?? 'Kepala Sekolah'
  const firstEnrollment = Array.isArray(student.class_students) ? student.class_students[0] : null
  const className = firstEnrollment?.classes?.name ?? '—'
  const homeroomTeacher = firstEnrollment?.classes?.profiles?.full_name ?? 'Wali Kelas'
  const semesterName = semesterRes.data?.name ?? '—'
  const academicYearName = semesterRes.data?.academic_years?.name ?? '—'

  const rows = grades
    .map(
      (g, i) => `
      <tr>
        <td style="text-align:center">${formatNumber(i + 1)}</td>
        <td>${g.component_name}</td>
        <td style="text-align:center">${formatNumber(g.weight)}%</td>
        <td style="text-align:center">${formatNumber(g.score, 2)}</td>
      </tr>`
    )
    .join('')

  const html = `
    <h1>${schoolName} — Rapor Siswa</h1>
    ${schoolAddress ? `<p class="meta">${schoolAddress}</p>` : ''}
    <p><strong>Nama:</strong> ${student.full_name} &nbsp;|&nbsp; <strong>NIS:</strong> ${student.nis}</p>
    <p><strong>Kelas:</strong> ${className} &nbsp;|&nbsp; <strong>Tahun Ajaran:</strong> ${academicYearName} — Semester ${semesterName}</p>
    <table>
      <thead>
        <tr>
          <th style="width:30px">No</th>
          <th>Komponen Nilai</th>
          <th style="width:70px">Bobot</th>
          <th style="width:80px">Nilai</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right; font-weight:bold">Nilai Akhir / Predikat</td>
          <td style="text-align:center; font-weight:bold">${formatNumber(nilaiAkhir, 2)} (${hurufAkhir})</td>
        </tr>
      </tfoot>
    </table>

    <h2 style="font-size:13pt; margin-top:20px; margin-bottom:8px">Ringkasan Kehadiran</h2>
    <table style="width:320px">
      <tbody>
        <tr><td>Hadir</td><td style="text-align:center; width:80px">${formatNumber(attendanceSummary.hadir)} hari</td></tr>
        <tr><td>Sakit</td><td style="text-align:center">${formatNumber(attendanceSummary.sakit)} hari</td></tr>
        <tr><td>Izin</td><td style="text-align:center">${formatNumber(attendanceSummary.izin)} hari</td></tr>
        <tr><td>Alfa</td><td style="text-align:center">${formatNumber(attendanceSummary.alfa)} hari</td></tr>
      </tbody>
    </table>

    <p class="meta" style="margin-top:16px">Tanggal Cetak: ${formatReportDate(new Date())}</p>
    <table style="margin-top:24px; border:none">
      <tbody>
        <tr>
          <td style="border:none; text-align:center; width:33%">Orang Tua / Wali<br/><br/><br/><br/>(___________________)</td>
          <td style="border:none; text-align:center; width:33%">Wali Kelas<br/><br/><br/><br/>(${homeroomTeacher})</td>
          <td style="border:none; text-align:center; width:33%">Kepala Sekolah<br/><br/><br/><br/>(${principalName})</td>
        </tr>
      </tbody>
    </table>
  `

  printHTML(html, 'Rapor Siswa')
}

/**
 * reportService.ts — generate laporan PDF untuk kehadiran dan rapor siswa.
 * Requirements: 11.1, 11.2
 */

import { getAttendanceRecap } from './attendanceService'
import { supabase } from './supabase'
import { printHTML } from '@/lib/pdfGenerator'

// ─── Laporan Kehadiran ────────────────────────────────────────────────────────

/**
 * Generate laporan kehadiran kelas dalam rentang tanggal sebagai PDF cetak.
 * Requirements: 11.1
 */
export async function generateAttendancePdf(
  classId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const recap = await getAttendanceRecap(classId, startDate, endDate)

  const rows = recap
    .map(
      (r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.full_name}</td>
        <td style="text-align:center">${r.hadir}</td>
        <td style="text-align:center">${r.sakit}</td>
        <td style="text-align:center">${r.izin}</td>
        <td style="text-align:center">${r.alpa}</td>
        <td style="text-align:center">${r.total}</td>
        <td style="text-align:center">${r.persentase_hadir}%</td>
      </tr>`
    )
    .join('')

  const html = `
    <h1>Laporan Kehadiran Siswa</h1>
    <p class="meta">Periode: ${startDate} s/d ${endDate}</p>
    <table>
      <thead>
        <tr>
          <th style="width:30px">No</th>
          <th>Nama Siswa</th>
          <th style="width:50px">Hadir</th>
          <th style="width:50px">Sakit</th>
          <th style="width:50px">Izin</th>
          <th style="width:50px">Alpa</th>
          <th style="width:50px">Total</th>
          <th style="width:70px">% Hadir</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="meta" style="margin-top:16px">Jumlah siswa: ${recap.length}</p>
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
 * Requirements: 11.2
 */
export async function generateReportCardPdf(
  studentId: string,
  semesterId: string
): Promise<void> {
  // Ambil data siswa
  const { data: studentData, error: studentError } = await supabase
    .from('students')
    .select('full_name, nis')
    .eq('id', studentId)
    .single()

  if (studentError) throw new Error(studentError.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = studentData as any

  // Ambil grade_components + grades dalam satu query via join
  const { data: gradeData, error: gradesError } = await supabase
    .from('grades')
    .select('score, grade_components(name, weight)')
    .eq('student_id', studentId)
    .eq('grade_components.semester_id', semesterId)

  if (gradesError) throw new Error(gradesError.message)

  // Normalkan hasil — filter baris yang grade_components-nya null (semester lain)
  const grades: GradeRow[] = (gradeData ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((g: any) => g.grade_components !== null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((g: any) => ({
      component_name: g.grade_components.name as string,
      weight: g.grade_components.weight as number,
      score: g.score as number,
    }))

  // Hitung nilai akhir (rata-rata berbobot)
  const totalWeight = grades.reduce((s, g) => s + g.weight, 0)
  const nilaiAkhir =
    totalWeight > 0
      ? Math.round((grades.reduce((s, g) => s + g.score * g.weight, 0) / totalWeight) * 10) / 10
      : 0

  const rows = grades
    .map(
      (g, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${g.component_name}</td>
        <td style="text-align:center">${g.weight}</td>
        <td style="text-align:center">${g.score}</td>
      </tr>`
    )
    .join('')

  const html = `
    <h1>Rapor Siswa</h1>
    <p><strong>Nama:</strong> ${student.full_name}</p>
    <p><strong>NIS:</strong> ${student.nis}</p>
    <table>
      <thead>
        <tr>
          <th style="width:30px">No</th>
          <th>Komponen Nilai</th>
          <th style="width:60px">Bobot</th>
          <th style="width:60px">Nilai</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right; font-weight:bold">Nilai Akhir</td>
          <td style="text-align:center; font-weight:bold">${nilaiAkhir}</td>
        </tr>
      </tfoot>
    </table>
  `

  printHTML(html, 'Rapor Siswa')
}

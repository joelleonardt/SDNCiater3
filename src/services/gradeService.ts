import { supabase } from './supabase'

// shortcut: same cast pattern as settingsService — bypasses typed-client inference for insert/upsert
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

function throwOnError(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradeComponent {
  id: string
  class_id: string
  semester_id: string
  name: string
  weight: number
}

export interface GradeRow {
  student_id: string
  full_name: string
  /** key = grade_component_id, value = score */
  grades: Record<string, number>
}

// ─── Grade Components ─────────────────────────────────────────────────────────

export async function getGradeComponents(
  classId: string,
  semesterId: string
): Promise<GradeComponent[]> {
  const { data, error } = await supabase
    .from('grade_components')
    .select('*')
    .eq('class_id', classId)
    .eq('semester_id', semesterId)
    .order('name')
  throwOnError(error, 'Gagal memuat komponen nilai')
  return data ?? []
}

export async function saveGradeComponents(
  components: { class_id: string; semester_id: string; name: string; weight: number }[]
): Promise<void> {
  if (components.length === 0) return
  const { class_id, semester_id } = components[0]

  // Hapus komponen lama untuk kombinasi kelas + semester ini
  const { error: deleteError } = await supabase
    .from('grade_components')
    .delete()
    .eq('class_id', class_id)
    .eq('semester_id', semester_id)
  throwOnError(deleteError, 'Gagal menghapus komponen nilai lama')

  const { error: insertError } = await db.from('grade_components').insert(components)
  throwOnError(insertError, 'Gagal menyimpan komponen nilai')
}

// ─── Grades ───────────────────────────────────────────────────────────────────

export async function getGrades(
  classId: string,
  semesterId: string
): Promise<GradeRow[]> {
  // Ambil semua siswa di kelas ini (cast ke any agar join students terima)
  const { data: classStudents, error: csError } = await db
    .from('class_students')
    .select('student_id, students(full_name)')
    .eq('class_id', classId)
  throwOnError(csError, 'Gagal memuat daftar siswa')

  // Ambil komponen nilai untuk kelas + semester ini
  const components = await getGradeComponents(classId, semesterId)
  const componentIds = components.map((c) => c.id)

  // Ambil semua nilai untuk komponen tersebut
  let allGrades: { student_id: string; grade_component_id: string; score: number }[] = []
  if (componentIds.length > 0) {
    const { data: gradesData, error: gradesError } = await supabase
      .from('grades')
      .select('student_id, grade_component_id, score')
      .in('grade_component_id', componentIds)
    throwOnError(gradesError, 'Gagal memuat nilai')
    allGrades = gradesData ?? []
  }

  type ClassStudentRow = { student_id: string; students: { full_name: string } | null }
  // Gabungkan: satu baris per siswa
  return ((classStudents ?? []) as ClassStudentRow[]).map((cs) => {
    // Supabase returns joined relation as object or null
    const student = cs.students as { full_name: string } | null
    const gradesMap: Record<string, number> = {}
    for (const g of allGrades) {
      if (g.student_id === cs.student_id) {
        gradesMap[g.grade_component_id] = g.score
      }
    }
    return {
      student_id: cs.student_id,
      full_name: student?.full_name ?? '',
      grades: gradesMap,
    }
  })
}

export async function saveGrades(
  grades: { student_id: string; grade_component_id: string; score: number }[]
): Promise<void> {
  if (grades.length === 0) return
  const { error } = await db
    .from('grades')
    .upsert(grades, { onConflict: 'student_id,grade_component_id' })
  throwOnError(error, 'Gagal menyimpan nilai')
}

// ─── Calculation ──────────────────────────────────────────────────────────────

/**
 * Hitung rata-rata tertimbang: sum(score * weight) / sum(weight).
 * Hanya komponen yang memiliki skor di `grades` yang dihitung.
 * Kembalikan 0 jika tidak ada komponen atau total bobot 0.
 */
export function calculateWeightedAverage(
  grades: Record<string, number>,
  components: GradeComponent[]
): number {
  let totalWeight = 0
  let weightedSum = 0
  for (const comp of components) {
    const score = grades[comp.id]
    if (score !== undefined) {
      weightedSum += score * comp.weight
      totalWeight += comp.weight
    }
  }
  return totalWeight === 0 ? 0 : weightedSum / totalWeight
}

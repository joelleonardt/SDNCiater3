import { supabase } from '@/services/supabase'
import type { Profile, Schedule, ScheduleInsert, ScheduleUpdate } from '@/types/database.types'

export type ScheduleWithDetails = Schedule & {
  class_name?: string
  teacher_name?: string
}

// shortcut: cast needed due to Supabase TS infers never on insert/update for some tables, upgrade when types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Ambil daftar guru aktif di sekolah untuk pilihan wali kelas dan jadwal (Req 5.2, 8.3).
 */
export async function getTeachers(schoolId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('school_id', schoolId)
    .eq('role', 'Guru')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getSchedulesByClass(classId: string): Promise<ScheduleWithDetails[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*, classes(name), profiles:teacher_id(full_name)')
    .eq('class_id', classId)
    .order('day_of_week')
    .order('start_time')
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    class_name: row.classes?.name ?? undefined,
    teacher_name: row.profiles?.full_name ?? undefined,
  }))
}

export async function getSchedulesByTeacher(teacherId: string): Promise<ScheduleWithDetails[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*, classes(name), profiles:teacher_id(full_name)')
    .eq('teacher_id', teacherId)
    .order('day_of_week')
    .order('start_time')
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    class_name: row.classes?.name ?? undefined,
    teacher_name: row.profiles?.full_name ?? undefined,
  }))
}

/**
 * Validasi konflik jadwal sebelum insert/update (Req 8.4, 8.5).
 */
export async function checkScheduleConflict(
  schedule: {
    teacher_id: string
    class_id: string
    day_of_week: number
    start_time: string
    end_time: string
  },
  excludeId?: string
): Promise<string | null> {
  // 1. Cek bentrok guru pada hari dan jam yang sama (Req 8.5)
  const { data: teacherSchedules, error: tErr } = await db
    .from('schedules')
    .select('id, subject, start_time, end_time, classes(name), profiles:teacher_id(full_name)')
    .eq('teacher_id', schedule.teacher_id)
    .eq('day_of_week', schedule.day_of_week)

  if (tErr) throw tErr

  const teacherConflict = (teacherSchedules || []).find((s: any) => {
    if (excludeId && s.id === excludeId) return false
    // Overlap: waktu mulai baru < selesai ada && waktu selesai baru > mulai ada
    return schedule.start_time < s.end_time && schedule.end_time > s.start_time
  })

  if (teacherConflict) {
    const teacherName = (teacherConflict as any).profiles?.full_name || 'Guru tersebut'
    const className = (teacherConflict as any).classes?.name ? `kelas ${(teacherConflict as any).classes.name}` : 'kelas lain'
    return `Guru ${teacherName} sudah memiliki jadwal mengajar di ${className} pada jam ${(teacherConflict as any).start_time.slice(0, 5)}–${(teacherConflict as any).end_time.slice(0, 5)}.`
  }

  // 2. Cek bentrok kelas pada hari dan jam yang sama
  const { data: classSchedules, error: cErr } = await db
    .from('schedules')
    .select('id, subject, start_time, end_time')
    .eq('class_id', schedule.class_id)
    .eq('day_of_week', schedule.day_of_week)

  if (cErr) throw cErr

  const classConflict = (classSchedules || []).find((s: any) => {
    if (excludeId && s.id === excludeId) return false
    return schedule.start_time < s.end_time && schedule.end_time > s.start_time
  })

  if (classConflict) {
    return `Kelas sudah memiliki jadwal pelajaran ${(classConflict as any).subject} pada jam ${(classConflict as any).start_time.slice(0, 5)}–${(classConflict as any).end_time.slice(0, 5)}.`
  }

  return null
}

export async function createSchedule(
  data: Omit<ScheduleInsert, 'id'>
): Promise<ScheduleWithDetails> {
  const conflict = await checkScheduleConflict({
    teacher_id: data.teacher_id,
    class_id: data.class_id,
    day_of_week: data.day_of_week,
    start_time: data.start_time,
    end_time: data.end_time,
  })
  if (conflict) {
    throw new Error(conflict)
  }

  const { data: created, error } = await db
    .from('schedules')
    .insert(data)
    .select('*, classes(name), profiles:teacher_id(full_name)')
    .single()
  if (error) throw error
  return {
    ...created,
    class_name: created.classes?.name ?? undefined,
    teacher_name: created.profiles?.full_name ?? undefined,
  }
}

export async function updateSchedule(
  id: string,
  data: ScheduleUpdate
): Promise<ScheduleWithDetails> {
  if (data.teacher_id || data.class_id || data.day_of_week || data.start_time || data.end_time) {
    const { data: existing } = await db.from('schedules').select('*').eq('id', id).single()
    if (existing) {
      const merged = {
        teacher_id: data.teacher_id ?? (existing as any).teacher_id,
        class_id: data.class_id ?? (existing as any).class_id,
        day_of_week: data.day_of_week ?? (existing as any).day_of_week,
        start_time: data.start_time ?? (existing as any).start_time,
        end_time: data.end_time ?? (existing as any).end_time,
      }
      const conflict = await checkScheduleConflict(merged, id)
      if (conflict) throw new Error(conflict)
    }
  }

  const { data: updated, error } = await db
    .from('schedules')
    .update(data)
    .eq('id', id)
    .select('*, classes(name), profiles:teacher_id(full_name)')
    .single()
  if (error) throw error
  return {
    ...updated,
    class_name: updated.classes?.name ?? undefined,
    teacher_name: updated.profiles?.full_name ?? undefined,
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) throw error
}

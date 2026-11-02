import { supabase } from '@/services/supabase'
import type { Schedule, ScheduleInsert, ScheduleUpdate } from '@/types/database.types'

// shortcut: cast needed due to Supabase TS infers never on insert/update for some tables, upgrade when types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getSchedulesByClass(classId: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('class_id', classId)
    .order('day_of_week')
    .order('start_time')
  if (error) throw error
  return data
}

export async function getSchedulesByTeacher(teacherId: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('day_of_week')
    .order('start_time')
  if (error) throw error
  return data
}

export async function createSchedule(
  data: Omit<ScheduleInsert, 'id'>
): Promise<Schedule> {
  const { data: created, error } = await db
    .from('schedules')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return created
}

export async function updateSchedule(
  id: string,
  data: ScheduleUpdate
): Promise<Schedule> {
  const { data: updated, error } = await db
    .from('schedules')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return updated
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) throw error
}

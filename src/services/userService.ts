import { supabase } from '@/services/supabase'
import type { Profile } from '@/types/database.types'

type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

// shortcut: Supabase typed-client infers `never` for update/insert when Views is Record<string,never>;
// casting via `any` bypasses the inference without weakening runtime safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/** Ambil semua pengguna aktif/nonaktif milik sekolah, diurutkan per nama. Requirements: 12.1 */
export async function getUsers(schoolId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('school_id', schoolId)
    .not('is_active', 'is', null)
    .order('full_name')

  if (error) throw new Error(error.message)
  return data
}

/** Perbarui peran pengguna. Requirements: 12.3 */
export async function updateUserRole(userId: string, role: Role): Promise<Profile> {
  const { data, error } = await db
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Aktifkan atau nonaktifkan pengguna. Requirements: 12.4 */
export async function toggleUserActive(userId: string, isActive: boolean): Promise<Profile> {
  const { data, error } = await db
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

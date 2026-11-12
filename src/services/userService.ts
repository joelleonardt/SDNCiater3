import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import type { Profile } from '@/types/database.types'

export type Role = 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'

export interface CreateUserInput {
  school_id: string
  full_name: string
  email: string
  password: string
  role: Role
}

// Client sekunder tanpa persistence untuk membuat akun baru tanpa mendepak sesi admin saat ini
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isolatedAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

// shortcut: Supabase typed-client infers `never` for update/insert when Views is Record<string,never>;
// casting via `any` bypasses the inference without weakening runtime safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/** Ambil semua pengguna aktif/nonaktif milik sekolah, diurutkan berdasarkan created_at menurun (Req 12.2). */
export async function getUsers(schoolId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('school_id', schoolId)
    .not('is_active', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

/** Buat pengguna baru langsung dari antarmuka (Req 12.3, 12.4, 12.5). */
export async function createUser(input: CreateUserInput): Promise<Profile> {
  const email = input.email.trim().toLowerCase()

  // 1. Cek duplikasi email sebelum mendaftar (Req 12.5)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    throw new Error('Email sudah terdaftar oleh pengguna lain.')
  }

  // 2. Buat akun di Supabase Auth via isolated client
  const { data: authData, error: authError } = await isolatedAuthClient.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name.trim(),
        role: input.role,
        school_id: input.school_id,
      },
    },
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('unique') || msg.includes('exists')) {
      throw new Error('Email sudah terdaftar oleh pengguna lain.')
    }
    throw new Error(authError.message)
  }

  const userId = authData.user?.id
  if (!userId) {
    throw new Error('Gagal membuat akun pengguna.')
  }

  // 3. Upsert ke profiles untuk memastikan data tersimpan langsung
  const { data: newProfile, error: profileError } = await db
    .from('profiles')
    .upsert({
      id: userId,
      school_id: input.school_id,
      full_name: input.full_name.trim(),
      email,
      role: input.role,
      is_active: true,
    })
    .select()
    .single()

  if (profileError) {
    // Jika upsert gagal (misal RLS trigger yang menanganinya), coba fetch
    const { data: fetched, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !fetched) {
      throw new Error(profileError.message)
    }
    return fetched
  }

  return newProfile
}

/** Perbarui peran pengguna. Requirements: 12.6, 12.7 */
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

/** Aktifkan atau nonaktifkan pengguna. Requirements: 12.8 */
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

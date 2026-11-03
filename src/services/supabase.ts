import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// shortcut: kalau env belum diset, buat client dummy agar app bisa render error UI
// upgrade: hapus fallback ini setelah env.local dikonfigurasi dengan benar
export const supabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co'

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

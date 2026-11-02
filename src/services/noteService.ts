import type { Note, NoteInsert, NoteUpdate } from '@/types/database.types'
import { supabase } from './supabase'

// shortcut: cast needed due to Supabase TS infers never on insert/update for some tables, upgrade when types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Ambil semua catatan untuk satu siswa, diurutkan dari terbaru.
 */
export async function getNotesByStudent(studentId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('student_id', studentId)
    .order('note_date', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Buat catatan baru untuk seorang siswa.
 */
export async function createNote(
  data: Pick<NoteInsert, 'student_id' | 'author_id' | 'category' | 'note_date' | 'content'>
): Promise<Note> {
  const { data: created, error } = await db
    .from('notes')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

/**
 * Perbarui catatan yang sudah ada (sebagian field).
 */
export async function updateNote(
  id: string,
  data: Pick<NoteUpdate, 'category' | 'note_date' | 'content'>
): Promise<Note> {
  const { data: updated, error } = await db
    .from('notes')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated
}

/**
 * Hapus catatan berdasarkan id.
 */
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

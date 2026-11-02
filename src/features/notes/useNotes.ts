import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast/useToast'
import type { Note, NoteInsert, NoteUpdate } from '@/types/database.types'
import {
  getNotesByStudent,
  createNote,
  updateNote,
  deleteNote,
} from '@/services/noteService'

/**
 * Hook untuk mengelola catatan (Perilaku/Prestasi) seorang siswa.
 */
export function useNotes(studentId: string) {
  const { toastSuccess, toastError } = useToast()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getNotesByStudent(studentId)
      setNotes(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat catatan'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  // Auto-load saat mount atau studentId berubah
  useEffect(() => {
    reload()
  }, [reload])

  async function addNote(
    data: Pick<NoteInsert, 'student_id' | 'author_id' | 'category' | 'note_date' | 'content'>
  ) {
    try {
      const created = await createNote(data)
      setNotes((prev) => [created, ...prev])
      toastSuccess('Catatan berhasil ditambahkan')
    } catch {
      toastError('Gagal menambahkan catatan')
    }
  }

  async function editNote(
    id: string,
    data: Pick<NoteUpdate, 'category' | 'note_date' | 'content'>
  ) {
    try {
      const updated = await updateNote(id, data)
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
      toastSuccess('Catatan berhasil diperbarui')
    } catch {
      toastError('Gagal memperbarui catatan')
    }
  }

  async function removeNote(id: string) {
    try {
      await deleteNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      toastSuccess('Catatan berhasil dihapus')
    } catch {
      toastError('Gagal menghapus catatan')
    }
  }

  return { notes, loading, error, reload, addNote, editNote, removeNote }
}

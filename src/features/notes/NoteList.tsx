import * as React from 'react'
import { Plus, FileText } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import SkeletonTable from '@/components/ui/SkeletonTable'
import { useAuthStore } from '@/stores/authStore'
import { useNotes } from './useNotes'
import NoteFormModal from './NoteFormModal'
import type { Note } from '@/types/database.types'

interface Props { studentId: string }

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', category === 'Perilaku' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')}>
      {category}
    </span>
  )
}

export default function NoteList({ studentId }: Props) {
  const profile = useAuthStore((s) => s.profile)
  const { notes, loading, addNote, editNote, removeNote } = useNotes(studentId)

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Note | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<Note | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  function openAdd() { setEditTarget(undefined); setModalOpen(true) }
  function openEdit(n: Note) { setEditTarget(n); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditTarget(undefined) }

  async function handleSave(values: { category: 'Perilaku' | 'Prestasi'; note_date: string; content: string }) {
    if (editTarget) {
      await editNote(editTarget.id, values)
    } else {
      await addNote({ ...values, student_id: studentId, author_id: profile?.id ?? '' })
    }
    closeModal()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try { await removeNote(deleteTarget.id) } finally {
      setIsDeleting(false); setDeleteTarget(null)
    }
  }

  if (loading) return <SkeletonTable columns={3} rows={3} delay={300} />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Tambah Catatan
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={FileText} title="Belum ada catatan" description="Belum ada catatan untuk siswa ini." />
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={n.category} />
                  <span className="text-xs text-muted-foreground">{formatDate(n.note_date)}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(n)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(n)}>Hapus</Button>
                </div>
              </div>
              <p className="leading-relaxed text-foreground">{n.content}</p>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && <NoteFormModal note={editTarget} onClose={closeModal} onSave={handleSave} />}

      <ConfirmDialog open={!!deleteTarget} message="Hapus catatan ini?" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={isDeleting} />
    </div>
  )
}

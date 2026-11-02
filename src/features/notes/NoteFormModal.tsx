import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Note } from '@/types/database.types'

const schema = z.object({
  category: z.enum(['Perilaku', 'Prestasi']),
  note_date: z.string().min(1, 'Tanggal wajib diisi'),
  content: z.string().min(1, 'Isi catatan wajib diisi').max(1000, 'Maksimal 1000 karakter'),
})

type FormValues = z.infer<typeof schema>

function todayISO() { return new Date().toISOString().slice(0, 10) }

interface Props {
  note?: Note
  onClose: () => void
  onSave: (values: FormValues) => Promise<void>
}

export default function NoteFormModal({ note, onClose, onSave }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: note?.category ?? 'Perilaku',
      note_date: note?.note_date ?? todayISO(),
      content: note?.content ?? '',
    },
  })

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function onValid(values: FormValues) { await onSave(values) }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="note-form-title"
        className={cn('w-full max-w-md rounded-lg border border-border bg-background shadow-xl', 'animate-in fade-in-0 zoom-in-95 duration-200')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="note-form-title" className="text-base font-semibold">{note ? 'Edit Catatan' : 'Tambah Catatan'}</h2>
        </div>
        <form onSubmit={handleSubmit(onValid)} noValidate>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="note-category">Kategori</Label>
              <select
                id="note-category"
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? 'note-category-error' : undefined}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register('category')}
              >
                <option value="Perilaku">Perilaku</option>
                <option value="Prestasi">Prestasi</option>
              </select>
              {errors.category && (
                <p id="note-category-error" role="alert" className="text-xs text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-date">
                Tanggal <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="note-date"
                type="date"
                aria-invalid={Boolean(errors.note_date)}
                aria-describedby={errors.note_date ? 'note-date-error' : undefined}
                {...register('note_date')}
              />
              {errors.note_date && (
                <p id="note-date-error" role="alert" className="text-xs text-destructive">
                  {errors.note_date.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-content">
                Isi Catatan <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <textarea
                id="note-content"
                rows={4}
                maxLength={1000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Tuliskan catatan di sini..."
                aria-invalid={Boolean(errors.content)}
                aria-describedby={errors.content ? 'note-content-error' : undefined}
                {...register('content')}
              />
              {errors.content && (
                <p id="note-content-error" role="alert" className="text-xs text-destructive">
                  {errors.content.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

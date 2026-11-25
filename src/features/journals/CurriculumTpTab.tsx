import * as React from 'react'
import { Wrench, Loader2, Trash2, BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import {
  SD_CURRICULUM_PRESETS,
  createCurriculumTp,
  deleteCurriculumTp,
  type CurriculumTpItem,
} from '@/services/journalService'
import type { Class } from '@/types/database.types'

export interface CurriculumTpTabProps {
  schoolId: string
  userId: string
  classes?: Class[]
  items: CurriculumTpItem[]
  loading: boolean
  canManage: boolean
  onRefresh: () => Promise<void>
}

const DEFAULT_GRADE_CLASSES = [
  'Kelas 1',
  'Kelas 2',
  'Kelas 3',
  'Kelas 4',
  'Kelas 5',
  'Kelas 6',
]

export default function CurriculumTpTab({
  schoolId,
  userId,
  items,
  loading,
  canManage,
  onRefresh,
}: CurriculumTpTabProps) {
  const { toastSuccess, toastError } = useToast()

  const [classLevel, setClassLevel] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [tpCode, setTpCode] = React.useState('')
  const [semester, setSemester] = React.useState<'Semester 1' | 'Semester 2'>('Semester 1')
  const [cp, setCp] = React.useState('')
  const [tpDescription, setTpDescription] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Filter daftar TP
  const [filterClass, setFilterClass] = React.useState('')
  const [filterSubject, setFilterSubject] = React.useState('')

  const classOptions = DEFAULT_GRADE_CLASSES

  const subjectOptions = React.useMemo(
    () => SD_CURRICULUM_PRESETS.map((p) => p.subject),
    []
  )

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (filterClass && item.class_level !== filterClass) return false
      if (filterSubject && item.subject !== filterSubject) return false
      return true
    })
  }, [items, filterClass, filterSubject])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!classLevel) {
      toastError('Kelas wajib dipilih', 'Silakan pilih kelas terlebih dahulu.')
      return
    }
    if (!subject) {
      toastError('Mata pelajaran wajib dipilih', 'Silakan pilih mata pelajaran.')
      return
    }
    if (!tpCode.trim()) {
      toastError('Kode TP wajib diisi', 'Masukkan kode TP (misal: 1.1).')
      return
    }
    if (!cp.trim()) {
      toastError('Capaian Pembelajaran wajib diisi', 'Masukkan Capaian Pembelajaran (CP).')
      return
    }
    if (!tpDescription.trim()) {
      toastError(
        'Deskripsi Tujuan Pembelajaran wajib diisi',
        'Masukkan Deskripsi Tujuan Pembelajaran (TP).'
      )
      return
    }

    setSubmitting(true)
    try {
      await createCurriculumTp({
        school_id: schoolId,
        class_level: classLevel,
        subject,
        tp_code: tpCode.trim(),
        semester,
        cp: cp.trim(),
        tp_description: tpDescription.trim(),
        created_by: userId,
      })
      toastSuccess(
        'Master Data TP disimpan',
        `TP ${tpCode.trim()} (${subject} — ${classLevel}) berhasil ditambahkan ke database.`
      )
      setTpCode('')
      setTpDescription('')
      await onRefresh()
    } catch (err) {
      toastError('Gagal menyimpan Master Data TP', (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item: CurriculumTpItem) {
    setDeletingId(item.id)
    try {
      await deleteCurriculumTp(item.id)
      toastSuccess('Data TP dihapus', `TP ${item.tp_code} (${item.subject}) telah dihapus.`)
      await onRefresh()
    } catch (err) {
      toastError('Gagal menghapus data TP', (err as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  const selectClass = cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50'
  )

  const textareaClass = cn(
    'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  )

  return (
    <div className="space-y-6">
      {/* Kartu Form Master Data TP (Kurikulum) — Sesuai Gambar Referensi */}
      {canManage && (
        <section
          aria-label="Master Data TP (Kurikulum)"
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
            <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
            Master Data TP (Kurikulum)
          </h2>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
            {/* Baris 1: Kelas & Mata Pelajaran */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tp-master-class">Kelas:</Label>
                <select
                  id="tp-master-class"
                  value={classLevel}
                  onChange={(e) => {
                    const nextClass = e.target.value
                    setClassLevel(nextClass)
                    if (!nextClass) {
                      setSubject('')
                    }
                  }}
                  className={selectClass}
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classOptions.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tp-master-subject">Mata Pelajaran:</Label>
                <select
                  id="tp-master-subject"
                  value={subject}
                  disabled={!classLevel}
                  onChange={(e) => {
                    const nextSubj = e.target.value
                    setSubject(nextSubj)
                    const existingForSubject = items.find(
                      (i) =>
                        i.subject === nextSubj &&
                        (!classLevel || i.class_level === classLevel)
                    )
                    if (existingForSubject?.cp) {
                      setCp(existingForSubject.cp)
                    } else {
                      const preset = SD_CURRICULUM_PRESETS.find((p) => p.subject === nextSubj)
                      if (preset && !cp.trim()) {
                        setCp(preset.defaultCp)
                      }
                    }
                  }}
                  className={selectClass}
                >
                  <option value="">
                    {classLevel ? '-- Pilih Mata Pelajaran --' : '-- Pilih Kelas Dahulu --'}
                  </option>
                  {subjectOptions.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Baris 2: Kode TP & Semester */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tp-master-code">Kode TP:</Label>
                <Input
                  id="tp-master-code"
                  placeholder="Misal: 1.1"
                  value={tpCode}
                  onChange={(e) => setTpCode(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tp-master-semester">Semester:</Label>
                <select
                  id="tp-master-semester"
                  value={semester}
                  onChange={(e) =>
                    setSemester(e.target.value as 'Semester 1' | 'Semester 2')
                  }
                  className={selectClass}
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                </select>
              </div>
            </div>

            {/* Baris 3: Capaian Pembelajaran (CP) */}
            <div className="space-y-1.5">
              <Label htmlFor="tp-master-cp">Capaian Pembelajaran (CP):</Label>
              <textarea
                id="tp-master-cp"
                rows={2}
                placeholder="Input Capaian Pembelajaran secara manual..."
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                className={cn(textareaClass, 'font-mono text-xs')}
              />
            </div>

            {/* Baris 4: Deskripsi Tujuan Pembelajaran (TP) */}
            <div className="space-y-1.5">
              <Label htmlFor="tp-master-desc">Deskripsi Tujuan Pembelajaran (TP):</Label>
              <textarea
                id="tp-master-desc"
                rows={2}
                placeholder="Tuliskan deskripsi Tujuan Pembelajaran (TP)..."
                value={tpDescription}
                onChange={(e) => setTpDescription(e.target.value)}
                className={textareaClass}
              />
            </div>

            {/* Tombol Simpan ke Database TP */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan ke Database TP
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Daftar Master Data TP yang Tersimpan */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <BookMarked className="h-4 w-4 text-primary" aria-hidden="true" />
              Daftar Master Data CP &amp; TP Tersimpan ({filteredItems.length})
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Data CP &amp; TP di bawah ini otomatis muncul sebagai pilihan saat Guru mengisi Input
              Jurnal Hari Ini.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter kelas master TP"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="">Semua Kelas</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter mapel master TP"
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="">Semua Mata Pelajaran</option>
              {subjectOptions.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memuat Master Data TP...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            Belum ada Master Data CP &amp; TP kustom yang disimpan. Tambahkan melalui form di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Kelas</th>
                  <th className="px-3 py-2.5">Mata Pelajaran</th>
                  <th className="px-3 py-2.5">Semester</th>
                  <th className="px-3 py-2.5">Kode TP</th>
                  <th className="px-3 py-2.5">Capaian Pembelajaran (CP)</th>
                  <th className="px-3 py-2.5">Deskripsi Tujuan Pembelajaran (TP)</th>
                  {canManage && <th className="px-3 py-2.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                      {item.class_level}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{item.subject}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {item.semester}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        {item.tp_code}
                      </span>
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-muted-foreground">{item.cp}</td>
                    <td className="max-w-sm px-3 py-2.5 text-foreground">
                      {item.tp_description}
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item)}
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          aria-label={`Hapus TP ${item.tp_code}`}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

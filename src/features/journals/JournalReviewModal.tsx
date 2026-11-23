import * as React from 'react'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { DailyJournalWithDetails } from '@/services/journalService'

export interface JournalReviewModalProps {
  open: boolean
  journal: DailyJournalWithDetails | null
  canReview: boolean
  onReview: (
    journalId: string,
    status: 'Disetujui' | 'Ditolak',
    reviewNotes: string
  ) => Promise<void>
  onClose: () => void
}

export default function JournalReviewModal({
  open,
  journal,
  canReview,
  onReview,
  onClose,
}: JournalReviewModalProps) {
  const [notes, setNotes] = React.useState('')
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [submittingAction, setSubmittingAction] = React.useState<'Disetujui' | 'Ditolak' | null>(
    null
  )

  React.useEffect(() => {
    if (open && journal) {
      setNotes(journal.review_notes ?? '')
      setValidationError(null)
      setSubmittingAction(null)
    }
  }, [open, journal])

  React.useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !journal) return null

  const currentJournal = journal

  async function handleDecision(decision: 'Disetujui' | 'Ditolak') {
    if (decision === 'Ditolak' && !notes.trim()) {
      setValidationError(
        'Catatan tinjauan wajib diisi saat menolak jurnal agar guru mengetahui bagian yang perlu diperbaiki.'
      )
      return
    }
    setValidationError(null)
    setSubmittingAction(decision)
    try {
      await onReview(currentJournal.id, decision, notes.trim())
    } finally {
      setSubmittingAction(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-review-title"
        className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 id="journal-review-title" className="text-base font-semibold text-foreground">
              {canReview ? 'Tinjauan Jurnal Harian Guru' : 'Detail Jurnal Harian'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {currentJournal.teacher_name} • {currentJournal.class_name} •{' '}
              {currentJournal.journal_date}
            </p>
          </div>
          <JournalStatusBadge status={currentJournal.status} />
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-5 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <div>
              <span className="block text-muted-foreground">Guru Pengajar</span>
              <span className="font-medium text-foreground">{currentJournal.teacher_name}</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Kelas &amp; Tanggal</span>
              <span className="font-medium text-foreground">
                {currentJournal.class_name} ({currentJournal.journal_date})
              </span>
            </div>
            <div className="col-span-2">
              <span className="block text-muted-foreground">Mata Pelajaran</span>
              <span className="font-medium text-foreground">{currentJournal.subject}</span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-muted-foreground">
              Materi / Topik Pembelajaran
            </span>
            <p className="mt-1 rounded-md border bg-card px-3 py-2 font-medium text-foreground">
              {currentJournal.topic}
            </p>
          </div>

          <div>
            <span className="block text-xs font-medium text-muted-foreground">
              Kegiatan &amp; Catatan Pembelajaran
            </span>
            <p className="mt-1 whitespace-pre-wrap rounded-md border bg-card px-3 py-2.5 text-foreground leading-relaxed">
              {currentJournal.activities}
            </p>
          </div>

          {canReview ? (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="review-notes">
                Catatan Tinjauan Kepala Sekolah{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  (Wajib diisi jika ditolak)
                </span>
              </Label>
              <textarea
                id="review-notes"
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                placeholder="Berikan apresiasi, masukan, atau alasan penolakan jurnal..."
                className={cn(
                  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              />
              {validationError && (
                <p role="alert" className="text-xs text-destructive">
                  {validationError}
                </p>
              )}
            </div>
          ) : (
            currentJournal.review_notes && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <span className="block font-semibold text-foreground">
                  Catatan Kepala Sekolah
                  {currentJournal.reviewer_name ? ` (${currentJournal.reviewer_name})` : ''}:
                </span>
                <p className="mt-1 text-muted-foreground">{currentJournal.review_notes}</p>
              </div>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submittingAction !== null}
          >
            Tutup
          </Button>

          {canReview && (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={submittingAction !== null}
                onClick={() => void handleDecision('Ditolak')}
              >
                {submittingAction === 'Ditolak' ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-1.5 h-4 w-4" />
                )}
                Tolak Jurnal
              </Button>
              <Button
                type="button"
                disabled={submittingAction !== null}
                onClick={() => void handleDecision('Disetujui')}
              >
                {submittingAction === 'Disetujui' ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Terima Jurnal
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function JournalStatusBadge({
  status,
}: {
  status: 'Menunggu_Tinjauan' | 'Disetujui' | 'Ditolak'
}) {
  if (status === 'Disetujui') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Disetujui
      </span>
    )
  }
  if (status === 'Ditolak') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/60 dark:text-red-300">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Ditolak
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      Menunggu Tinjauan
    </span>
  )
}

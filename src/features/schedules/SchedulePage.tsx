import * as React from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import PageHeader from '@/components/ui/PageHeader'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { getClasses } from '@/services/classService'
import type { Class, Schedule } from '@/types/database.types'
import { useSchedules } from './useSchedules'
import WeeklyGrid from './WeeklyGrid'
import ScheduleFormModal, { type JadwalForm } from './ScheduleFormModal'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast/useToast'

// UNIQUE-violation error code dari Postgres / Supabase
const UNIQUE_VIOLATION = '23505'

/**
 * Halaman Jadwal Pelajaran.
 * - Pilih kelas → tampil WeeklyGrid
 * - Tambah/Edit via ScheduleFormModal
 * - Hapus via ConfirmDialog
 * Requirements: 10.1–10.5
 */
export default function SchedulePage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)

  const canEdit = profile?.role === 'Guru' || profile?.role === 'Staf_Admin'
  const { toastError } = useToast()

  // ── Daftar kelas ──────────────────────────────────────────────────────────
  const [classes, setClasses] = React.useState<Class[]>([])
  const [selectedClassId, setSelectedClassId] = React.useState<string>('')

  React.useEffect(() => {
    if (!profile?.school_id || !activeAcademicYear?.id) return
    getClasses(profile.school_id, activeAcademicYear.id)
      .then((data) => {
        setClasses(data)
        if (data.length > 0 && !selectedClassId) setSelectedClassId(data[0].id)
      })
      .catch(() => {
        toastError('Gagal memuat daftar kelas')
      })
  }, [profile?.school_id, activeAcademicYear?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Jadwal untuk kelas terpilih ───────────────────────────────────────────
  const { schedules, loading, createSchedule, updateSchedule, deleteSchedule } =
    useSchedules(selectedClassId || undefined)

  // ── Modal tambah/edit ─────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Schedule | undefined>()
  const [defaultDay, setDefaultDay] = React.useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  // ── Konfirmasi hapus ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<Schedule | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // ── Handlers modal ────────────────────────────────────────────────────────
  function openAdd(day: number) {
    setEditTarget(undefined)
    setDefaultDay(day)
    setServerError(null)
    setModalOpen(true)
  }

  function openEdit(schedule: Schedule) {
    setEditTarget(schedule)
    setDefaultDay(undefined)
    setServerError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditTarget(undefined)
    setDefaultDay(undefined)
    setServerError(null)
  }

  async function handleFormSubmit(values: JadwalForm) {
    if (!profile?.id || !selectedClassId) return
    setIsSubmitting(true)
    setServerError(null)
    try {
      if (editTarget) {
        await updateSchedule(editTarget.id, values)
      } else {
        await createSchedule({
          ...values,
          class_id: selectedClassId,
          teacher_id: profile.id,
        })
      }
      closeModal()
    } catch (err) {
      // Deteksi UNIQUE violation (bentrok jadwal)
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes(UNIQUE_VIOLATION) || msg.toLowerCase().includes('unique')) {
        setServerError('Jadwal bentrok dengan jadwal lain pada hari dan jam yang sama')
      } else {
        setServerError(msg || 'Gagal menyimpan jadwal')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteSchedule(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      // toast sudah ditampilkan di hook
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Jadwal Pelajaran"
        description={
          activeAcademicYear
            ? `Tahun ajaran: ${activeAcademicYear.name}`
            : 'Pilih tahun ajaran aktif untuk melihat jadwal'
        }
      />

      {/* Pilih kelas */}
      {classes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Kelas:</span>
          {classes.map((cls) => (
            <Button
              key={cls.id}
              size="sm"
              variant={selectedClassId === cls.id ? 'default' : 'outline'}
              onClick={() => setSelectedClassId(cls.id)}
            >
              {cls.name}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {activeAcademicYear
            ? 'Belum ada kelas untuk tahun ajaran ini.'
            : 'Pilih tahun ajaran aktif terlebih dahulu.'}
        </p>
      )}

      {/* Grid jadwal */}
      {selectedClassId && (
        <div
          className={cn(
            'rounded-lg border border-border bg-background p-4',
            loading && 'opacity-60',
          )}
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat jadwal…</p>
          ) : (
            <WeeklyGrid
              schedules={schedules}
              onEdit={openEdit}
              onAdd={openAdd}
              onDelete={setDeleteTarget}
              canEdit={canEdit}
            />
          )}
        </div>
      )}

      {/* Modal tambah/edit */}
      {modalOpen && (
        <ScheduleFormModal
          initialData={editTarget}
          defaultDay={defaultDay}
          isSubmitting={isSubmitting}
          serverError={serverError}
          onSubmit={handleFormSubmit}
          onCancel={closeModal}
        />
      )}

      {/* Dialog konfirmasi hapus */}
      <ConfirmDialog
        open={!!deleteTarget}
        recordName={deleteTarget?.subject}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </div>
  )
}

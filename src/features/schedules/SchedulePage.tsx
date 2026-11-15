import * as React from 'react'
import { Calendar } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import PageHeader from '@/components/ui/PageHeader'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { getClasses } from '@/services/classService'
import { getTeachers, type ScheduleWithDetails } from '@/services/scheduleService'
import type { Class, Profile } from '@/types/database.types'
import { useSchedules } from './useSchedules'
import WeeklyGrid from './WeeklyGrid'
import ScheduleFormModal, { type JadwalForm } from './ScheduleFormModal'
import { cn, getErrorMessage } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast/useToast'

// UNIQUE-violation error code dari Postgres / Supabase
const UNIQUE_VIOLATION = '23505'

/**
 * Halaman Jadwal Pelajaran / Jadwal Mengajar.
 * - Guru: otomatis melihat jadwal mengajar dirinya sendiri (Req 8.2, 8.6)
 * - Staf_Admin & Kepala_Sekolah: dapat memilih lihat per Kelas atau per Guru
 * - Staf_Admin dapat menambah, mengedit, dan menghapus jadwal (Req 8.3)
 * Requirements: 8.1–8.6
 */
export default function SchedulePage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)
  const isGuru = profile?.role === 'Guru'

  // Hanya Staf_Admin yang boleh mengelola CUD jadwal (Req 1.4 & 8.3)
  const canEdit = profile?.role === 'Staf_Admin'
  const { toastError } = useToast()

  // ── Mode tampilan (per kelas vs per guru) ──────────────────────────────────
  const [viewMode, setViewMode] = React.useState<'class' | 'teacher'>(isGuru ? 'teacher' : 'class')

  // ── Data Kelas & Guru ─────────────────────────────────────────────────────
  const [classes, setClasses] = React.useState<Class[]>([])
  const [teachers, setTeachers] = React.useState<Profile[]>([])
  const [selectedClassId, setSelectedClassId] = React.useState<string>('')
  const [selectedTeacherId, setSelectedTeacherId] = React.useState<string>(isGuru ? (profile?.id ?? '') : '')

  React.useEffect(() => {
    if (!profile?.school_id) return

    // Muat daftar guru aktif
    getTeachers(profile.school_id)
      .then((data) => {
        setTeachers(data)
        if (!isGuru && data.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(data[0].id)
        }
      })
      .catch((err) => toastError('Gagal memuat daftar guru', getErrorMessage(err, 'Terjadi kesalahan.')))

    // Muat daftar kelas jika ada tahun ajaran aktif
    if (activeAcademicYear?.id) {
      getClasses(profile.school_id, activeAcademicYear.id)
        .then((data) => {
          setClasses(data)
          if (data.length > 0 && !selectedClassId) setSelectedClassId(data[0].id)
        })
        .catch((err) => toastError('Gagal memuat daftar kelas', getErrorMessage(err, 'Terjadi kesalahan.')))
    }
  }, [profile?.school_id, activeAcademicYear?.id, isGuru]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Jadwal ────────────────────────────────────────────────────────────────
  const activeClassFilter = viewMode === 'class' ? selectedClassId : undefined
  const activeTeacherFilter = viewMode === 'teacher' ? (isGuru ? profile?.id : selectedTeacherId) : undefined

  const { schedules, loading, createSchedule, updateSchedule, deleteSchedule } =
    useSchedules(activeClassFilter, activeTeacherFilter, isGuru)

  // ── Modal tambah/edit ─────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<ScheduleWithDetails | undefined>()
  const [defaultDay, setDefaultDay] = React.useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  // ── Konfirmasi hapus ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<ScheduleWithDetails | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // ── Handlers modal ────────────────────────────────────────────────────────
  function openAdd(day: number) {
    setEditTarget(undefined)
    setDefaultDay(day)
    setServerError(null)
    setModalOpen(true)
  }

  function openEdit(schedule: ScheduleWithDetails) {
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
    setIsSubmitting(true)
    setServerError(null)
    try {
      if (editTarget) {
        await updateSchedule(editTarget.id, values)
      } else {
        await createSchedule(values)
      }
      closeModal()
    } catch (err) {
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
        title={isGuru ? 'Jadwal Mengajar Saya' : 'Jadwal Pelajaran'}
        description={
          activeAcademicYear
            ? `Tahun ajaran: ${activeAcademicYear.name}`
            : 'Pilih tahun ajaran aktif untuk melihat jadwal'
        }
      />

      {/* Mode toggle (Hanya untuk Staf_Admin & Kepala_Sekolah) */}
      {!isGuru && (
        <div className="flex gap-2 border-b border-border pb-3">
          <Button
            size="sm"
            variant={viewMode === 'class' ? 'default' : 'outline'}
            onClick={() => setViewMode('class')}
          >
            Lihat Per Kelas
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'teacher' ? 'default' : 'outline'}
            onClick={() => setViewMode('teacher')}
          >
            Lihat Per Guru
          </Button>
        </div>
      )}

      {/* Selector: Kelas */}
      {viewMode === 'class' && !isGuru && (
        classes.length > 0 ? (
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
        )
      )}

      {/* Selector: Guru (Hanya untuk Admin/Kepsek yang memilih mode per guru) */}
      {viewMode === 'teacher' && !isGuru && (
        teachers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Guru:</span>
            {teachers.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={selectedTeacherId === t.id ? 'default' : 'outline'}
                onClick={() => setSelectedTeacherId(t.id)}
              >
                {t.full_name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data guru terdaftar.</p>
        )
      )}

      {/* Grid jadwal atau Empty State */}
      {(viewMode === 'class' ? !!selectedClassId : !!(isGuru ? profile?.id : selectedTeacherId)) && (
        <div
          className={cn(
            'rounded-lg border border-border bg-background p-4',
            loading && 'opacity-60',
          )}
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat jadwal…</p>
          ) : schedules.length === 0 && !canEdit ? (
            <EmptyState
              icon={Calendar}
              title="Belum ada jadwal"
              description={
                isGuru
                  ? 'Belum ada jadwal mengajar yang ditugaskan kepada Anda.'
                  : 'Belum ada jadwal yang terdaftar untuk pilihan ini.'
              }
            />
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
          defaultClassId={selectedClassId}
          defaultTeacherId={isGuru ? profile?.id : selectedTeacherId}
          classes={classes}
          teachers={teachers}
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

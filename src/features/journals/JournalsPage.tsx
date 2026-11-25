import * as React from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  BellRing,
  Eye,
  Pencil,
  Trash2,
  ClipboardCheck,
  Loader2,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { getClasses } from '@/services/classService'
import {
  getDailyJournals,
  createDailyJournal,
  updateDailyJournal,
  deleteDailyJournal,
  reviewDailyJournal,
  getTeacherJournalCompliance,
  sendJournalReminder,
  sendBulkJournalReminders,
  isUsingLocalJournalFallback,
  printDailyJournalsPdf,
  getCurriculumTps,
  type DailyJournalWithDetails,
  type JournalStatus,
  type TeacherJournalComplianceItem,
  type CurriculumTpItem,
} from '@/services/journalService'
import type { Class } from '@/types/database.types'
import JournalFormModal, {
  JournalFormFields,
  type JournalFormValues,
} from './JournalFormModal'
import JournalReviewModal, { JournalStatusBadge } from './JournalReviewModal'
import CurriculumTpTab from './CurriculumTpTab'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type ActiveTab = 'jurnal' | 'master_tp' | 'kepatuhan'

export default function JournalsPage() {
  const profile = useAuthStore((s) => s.profile)
  const activeAcademicYear = useAppStore((s) => s.activeAcademicYear)
  const { toastSuccess, toastError } = useToast()

  const role = profile?.role
  const isGuru = role === 'Guru'
  const isKepsek = role === 'Kepala_Sekolah'
  const isAdmin = role === 'Staf_Admin'
  const canViewCompliance = isAdmin || isKepsek

  const [activeTab, setActiveTab] = React.useState<ActiveTab>('jurnal')

  // Data kelas untuk filter & form
  const [classes, setClasses] = React.useState<Class[]>([])

  // Rentang tanggal untuk Cetak Jurnal di bagian kanan atas (sesuai referensi gambar)
  const [printStartDate, setPrintStartDate] = React.useState(todayISO())
  const [printEndDate, setPrintEndDate] = React.useState(todayISO())

  // Filter daftar jurnal
  const [filterClassId, setFilterClassId] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<JournalStatus | ''>('')
  const [filterDate, setFilterDate] = React.useState('')

  // State daftar jurnal
  const [journals, setJournals] = React.useState<DailyJournalWithDetails[]>([])
  const [journalsLoading, setJournalsLoading] = React.useState(true)

  // Modal edit jurnal (Guru)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingJournal, setEditingJournal] = React.useState<DailyJournalWithDetails | undefined>(
    undefined
  )

  // Modal tinjauan (Kepala Sekolah) / lihat detail
  const [reviewingJournal, setReviewingJournal] =
    React.useState<DailyJournalWithDetails | null>(null)

  // Dialog konfirmasi hapus
  const [deletingJournal, setDeletingJournal] =
    React.useState<DailyJournalWithDetails | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // Tab Master Data TP (Kurikulum)
  const [curriculumTps, setCurriculumTps] = React.useState<CurriculumTpItem[]>([])
  const [curriculumTpsLoading, setCurriculumTpsLoading] = React.useState(false)

  // Tab 3: Pantauan Kepatuhan Guru & Pengingat (Admin / Kepsek)
  const [complianceDate, setComplianceDate] = React.useState(todayISO())
  const [complianceList, setComplianceList] = React.useState<TeacherJournalComplianceItem[]>([])
  const [complianceLoading, setComplianceLoading] = React.useState(false)
  const [remindingTeacherId, setRemindingTeacherId] = React.useState<string | null>(null)
  const [bulkReminding, setBulkReminding] = React.useState(false)

  // Load kelas
  React.useEffect(() => {
    if (!profile?.school_id) return
    getClasses(profile.school_id, activeAcademicYear?.id ?? null)
      .then(setClasses)
      .catch(() => {
        setClasses([])
      })
  }, [profile?.school_id, activeAcademicYear?.id])

  // Load Master Data TP (Kurikulum)
  const loadCurriculumTps = React.useCallback(async () => {
    setCurriculumTpsLoading(true)
    try {
      const items = await getCurriculumTps(profile?.school_id ?? undefined)
      setCurriculumTps(items)
    } catch {
      setCurriculumTps([])
    } finally {
      setCurriculumTpsLoading(false)
    }
  }, [profile?.school_id])

  React.useEffect(() => {
    void loadCurriculumTps()
  }, [loadCurriculumTps])

  // Kelas otomatis untuk wali kelas yang sedang login
  const defaultGuruClassId = React.useMemo(() => {
    if (!profile?.id) return classes[0]?.id ?? ''
    const homeroomClass = classes.find((c) => c.homeroom_teacher_id === profile.id)
    return homeroomClass?.id ?? classes[0]?.id ?? ''
  }, [classes, profile?.id])

  const loadJournals = React.useCallback(async () => {
    if (!profile?.school_id) {
      setJournals([])
      setJournalsLoading(false)
      return
    }
    setJournalsLoading(true)
    try {
      const list = await getDailyJournals({
        schoolId: profile.school_id,
        teacherId: isGuru ? profile.id : undefined,
        classId: filterClassId || undefined,
        status: filterStatus || undefined,
        startDate: filterDate || undefined,
        endDate: filterDate || undefined,
      })
      setJournals(list)
    } catch (err) {
      toastError('Gagal memuat jurnal harian', (err as Error).message)
    } finally {
      setJournalsLoading(false)
    }
  }, [profile?.school_id, profile?.id, isGuru, filterClassId, filterStatus, filterDate, toastError])

  React.useEffect(() => {
    void loadJournals()
  }, [loadJournals])

  const loadCompliance = React.useCallback(async () => {
    if (!profile?.school_id || !canViewCompliance) return
    setComplianceLoading(true)
    try {
      const items = await getTeacherJournalCompliance(profile.school_id, complianceDate)
      setComplianceList(items)
    } catch (err) {
      toastError('Gagal memuat pantauan pengisian jurnal', (err as Error).message)
    } finally {
      setComplianceLoading(false)
    }
  }, [profile?.school_id, canViewCompliance, complianceDate, toastError])

  React.useEffect(() => {
    if (activeTab === 'kepatuhan' && canViewCompliance) {
      void loadCompliance()
    }
  }, [activeTab, canViewCompliance, loadCompliance])

  // Handlers Guru (Tambah langsung dari form "Input Jurnal Hari Ini" & Edit dari modal)
  async function handleCreateSubmit(values: JournalFormValues) {
    if (!profile?.school_id) return
    try {
      await createDailyJournal({
        school_id: profile.school_id,
        teacher_id: profile.id,
        ...values,
      })
      toastSuccess('Jurnal tersimpan', 'Jurnal pembelajaran berhasil disimpan ke sistem.')
      await loadJournals()
    } catch (err) {
      toastError('Gagal menyimpan jurnal', (err as Error).message)
    }
  }

  async function handleEditSubmit(values: JournalFormValues) {
    if (!profile?.school_id || !editingJournal) return
    try {
      await updateDailyJournal(editingJournal.id, values)
      toastSuccess('Jurnal diperbarui', 'Jurnal pembelajaran berhasil diperbarui dan diajukan ulang.')
      setFormOpen(false)
      setEditingJournal(undefined)
      await loadJournals()
    } catch (err) {
      toastError('Gagal memperbarui jurnal', (err as Error).message)
    }
  }

  function handlePrintJournals() {
    if (printStartDate && printEndDate && printStartDate > printEndDate) {
      toastError(
        'Rentang tanggal tidak valid',
        'Tanggal awal cetak tidak boleh melebihi tanggal akhir.'
      )
      return
    }
    const filteredForPrint = journals.filter((j) => {
      if (printStartDate && j.journal_date < printStartDate) return false
      if (printEndDate && j.journal_date > printEndDate) return false
      return true
    })
    const targetList = filteredForPrint.length > 0 ? filteredForPrint : journals
    try {
      printDailyJournalsPdf(targetList, {
        startDate: printStartDate || undefined,
        endDate: printEndDate || undefined,
        schoolName: 'SDN Ciater 03',
      })
      toastSuccess('Dialog cetak dibuka', 'Gunakan dialog cetak browser untuk menyimpan PDF.')
    } catch (err) {
      toastError('Gagal mencetak jurnal', (err as Error).message)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingJournal) return
    setDeleteLoading(true)
    try {
      await deleteDailyJournal(deletingJournal.id)
      toastSuccess('Jurnal dihapus', 'Jurnal harian berhasil dihapus.')
      setDeletingJournal(null)
      await loadJournals()
    } catch (err) {
      toastError('Gagal menghapus jurnal', (err as Error).message)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handler Kepala Sekolah (Terima / Tolak)
  async function handleReview(
    journalId: string,
    status: 'Disetujui' | 'Ditolak',
    reviewNotes: string
  ) {
    if (!profile) return
    try {
      await reviewDailyJournal({
        journal_id: journalId,
        reviewer_id: profile.id,
        status,
        review_notes: reviewNotes || null,
      })
      toastSuccess(
        status === 'Disetujui' ? 'Jurnal disetujui' : 'Jurnal ditolak',
        status === 'Disetujui'
          ? 'Jurnal harian telah diterima dan notifikasi dikirim ke guru.'
          : 'Jurnal harian ditolak beserta catatan revisi untuk guru.'
      )
      setReviewingJournal(null)
      await loadJournals()
    } catch (err) {
      toastError('Gagal menyimpan tinjauan', (err as Error).message)
    }
  }

  // Handler Pengingat (Staf Admin / Kepala Sekolah)
  async function handleSendReminder(item: TeacherJournalComplianceItem) {
    if (!profile?.school_id) return
    setRemindingTeacherId(item.teacher_id)
    try {
      await sendJournalReminder({
        school_id: profile.school_id,
        sender_id: profile.id,
        recipient_id: item.teacher_id,
        target_date: complianceDate,
      })
      toastSuccess(
        'Pengingat terkirim',
        `Notifikasi pengingat jurnal harian dikirim ke ${item.teacher_name}.`
      )
      await loadCompliance()
    } catch (err) {
      toastError('Gagal mengirim pengingat', (err as Error).message)
    } finally {
      setRemindingTeacherId(null)
    }
  }

  async function handleBulkRemind() {
    if (!profile?.school_id) return
    const missingTeachers = complianceList.filter((t) => !t.has_submitted)
    if (missingTeachers.length === 0) return

    setBulkReminding(true)
    try {
      const count = await sendBulkJournalReminders({
        school_id: profile.school_id,
        sender_id: profile.id,
        recipient_ids: missingTeachers.map((t) => t.teacher_id),
        target_date: complianceDate,
      })
      toastSuccess(
        'Pengingat massal terkirim',
        `Notifikasi pengingat berhasil dikirim ke ${count} guru yang belum mengisi jurnal.`
      )
      await loadCompliance()
    } catch (err) {
      toastError('Gagal mengirim pengingat massal', (err as Error).message)
    } finally {
      setBulkReminding(false)
    }
  }

  // Statistik ringkas
  const totalCount = journals.length
  const pendingCount = journals.filter((j) => j.status === 'Menunggu_Tinjauan').length
  const approvedCount = journals.filter((j) => j.status === 'Disetujui').length
  const rejectedCount = journals.filter((j) => j.status === 'Ditolak').length

  const submittedTeachersCount = complianceList.filter((t) => t.has_submitted).length
  const missingTeachersCount = complianceList.filter((t) => !t.has_submitted).length

  return (
    <div className="space-y-6 p-6">
      {/* Header Jurnal Pembelajaran + Rentang Tanggal & Tombol Cetak Jurnal */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="inline-block border-b-2 border-primary pb-1.5 text-xl font-bold text-foreground">
            Jurnal Pembelajaran
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {isGuru
              ? 'Input jurnal pembelajaran harian (CP, TP, Materi Pokok, IKTP, Metode, Media, Refleksi) dan pantau tinjauan Kepala Sekolah'
              : isKepsek
                ? 'Tinjau jurnal pembelajaran harian guru (terima atau tolak) dan cetak laporan jurnal'
                : 'Pantau pengisian jurnal harian guru, kirimkan pengingat in-app, dan cetak jurnal'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Dari tanggal cetak jurnal"
            value={printStartDate}
            onChange={(e) => setPrintStartDate(e.target.value)}
            className="h-9 w-36 text-xs"
          />
          <Input
            type="date"
            aria-label="Sampai tanggal cetak jurnal"
            value={printEndDate}
            onChange={(e) => setPrintEndDate(e.target.value)}
            className="h-9 w-36 text-xs"
          />
          <Button type="button" size="sm" onClick={handlePrintJournals}>
            <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Cetak Jurnal
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadJournals()
              void loadCurriculumTps()
              if (activeTab === 'kepatuhan' && canViewCompliance) {
                void loadCompliance()
              }
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Muat Ulang
          </Button>
        </div>
      </div>

      {isUsingLocalJournalFallback() && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold">
              Tabel database <code>public.daily_journals</code> belum dibuat di Supabase SQL Editor.
            </span>{' '}
            Saat ini jurnal disimpan di penyimpanan lokal browser dan belum tersinkronisasi
            antar-akun atau browser berbeda. Jalankan query pembuatan tabel{' '}
            <code>daily_journals</code> &amp; <code>notifications</code> di Supabase SQL Editor agar
            jurnal yang diisi Guru langsung muncul di akun Kepala Sekolah dan Staf Admin.
          </div>
        </div>
      )}

      {/* Tab switcher: Jurnal Pembelajaran, Master Data TP (Kurikulum), & Pantauan Guru */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('jurnal')}
          aria-pressed={activeTab === 'jurnal'}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'jurnal'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Daftar Jurnal Harian
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('master_tp')}
          aria-pressed={activeTab === 'master_tp'}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'master_tp'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Master Data TP (Kurikulum)
        </button>
        {canViewCompliance && (
          <button
            type="button"
            onClick={() => setActiveTab('kepatuhan')}
            aria-pressed={activeTab === 'kepatuhan'}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'kepatuhan'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pantauan &amp; Pengingat Guru
          </button>
        )}
      </div>

      {/* Panel Form Langsung: "Input Jurnal Hari Ini" untuk Guru (Sesuai Gambar Referensi) */}
      {isGuru && activeTab === 'jurnal' && (
        <section
          aria-label="Input Jurnal Hari Ini"
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            Input Jurnal Hari Ini
          </h2>

          <JournalFormFields
            classes={classes}
            defaultClassId={defaultGuruClassId}
            curriculumTps={curriculumTps}
            onSubmit={handleCreateSubmit}
          />
        </section>
      )}

      {/* ── TAB 2: Master Data TP (Kurikulum) ──────────────────────────────── */}
      {activeTab === 'master_tp' && (
        <CurriculumTpTab
          schoolId={profile?.school_id ?? ''}
          userId={profile?.id ?? ''}
          classes={classes}
          items={curriculumTps}
          loading={curriculumTpsLoading}
          canManage={isGuru || isAdmin || isKepsek}
          onRefresh={loadCurriculumTps}
        />
      )}

      {/* ── TAB 1: Daftar Jurnal Harian ────────────────────────────────────── */}
      {activeTab === 'jurnal' && (
        <div className="space-y-5">
          {/* Kartu ringkasan */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="text-xs text-muted-foreground">Total Jurnal</span>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Menunggu Tinjauan
              </span>
              <p className="mt-1 text-2xl font-bold text-foreground">{pendingCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Disetujui
              </span>
              <p className="mt-1 text-2xl font-bold text-foreground">{approvedCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Ditolak / Perlu Revisi
              </span>
              <p className="mt-1 text-2xl font-bold text-foreground">{rejectedCount}</p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="filter-journal-class" className="text-xs">
                Filter Kelas
              </Label>
              <select
                id="filter-journal-class"
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-journal-status" className="text-xs">
                Filter Status Tinjauan
              </Label>
              <select
                id="filter-journal-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as JournalStatus | '')}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Semua Status</option>
                <option value="Menunggu_Tinjauan">Menunggu Tinjauan</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-journal-date" className="text-xs">
                Filter Tanggal
              </Label>
              <div className="flex gap-2">
                <Input
                  id="filter-journal-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="h-9"
                />
                {filterDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterDate('')}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tabel daftar jurnal */}
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {journalsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat daftar jurnal pembelajaran...
              </div>
            ) : journals.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">Belum ada jurnal harian</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {isGuru
                    ? 'Isi form "Input Jurnal Hari Ini" di atas lalu klik "Simpan Jurnal ke Sistem".'
                    : 'Belum ada jurnal pembelajaran guru yang cocok dengan filter yang dipilih.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      {!isGuru && <th className="px-4 py-3">Guru</th>}
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3">Mapel, Materi &amp; Perangkat Ajar</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {journals.map((j) => (
                      <tr key={j.id} className="hover:bg-muted/20">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                          {j.journal_date}
                        </td>
                        {!isGuru && (
                          <td className="px-4 py-3 text-foreground">{j.teacher_name}</td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          Kelas {j.class_name}
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <div className="font-medium text-foreground">{j.subject}</div>
                          <div className="text-xs text-muted-foreground">
                            Materi Pokok: <span className="text-foreground">{j.topic}</span>
                          </div>
                          {(j.method || j.media || j.iktp) && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {[
                                j.iktp ? `IKTP: ${j.iktp}` : '',
                                j.method ? `Metode: ${j.method}` : '',
                                j.media ? `Media: ${j.media}` : '',
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                          )}
                          {j.review_notes && (
                            <div className="mt-1 rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Catatan Kepsek: </span>
                              {j.review_notes}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <JournalStatusBadge status={j.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isKepsek ? (
                              <Button
                                type="button"
                                size="sm"
                                variant={j.status === 'Menunggu_Tinjauan' ? 'default' : 'outline'}
                                onClick={() => setReviewingJournal(j)}
                              >
                                <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                                Tinjau Jurnal
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setReviewingJournal(j)}
                                aria-label={`Lihat detail jurnal ${j.subject}`}
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                Detail
                              </Button>
                            )}

                            {isGuru && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingJournal(j)
                                    setFormOpen(true)
                                  }}
                                  aria-label={`Edit jurnal ${j.subject}`}
                                >
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  {j.status === 'Ditolak' ? 'Perbaiki' : 'Edit'}
                                </Button>
                                {j.status !== 'Disetujui' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeletingJournal(j)}
                                    aria-label={`Hapus jurnal ${j.subject}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Pantauan & Pengingat Guru (Admin & Kepsek) ──────────────── */}
      {activeTab === 'kepatuhan' && canViewCompliance && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <Label htmlFor="compliance-date" className="text-xs">
                Tanggal Pantauan Jurnal Harian
              </Label>
              <Input
                id="compliance-date"
                type="date"
                max={todayISO()}
                value={complianceDate}
                onChange={(e) => setComplianceDate(e.target.value)}
                className="h-9 w-48"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs text-muted-foreground">
                Sudah mengisi:{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {submittedTeachersCount}
                </strong>{' '}
                • Belum mengisi:{' '}
                <strong className="text-amber-700 dark:text-amber-300">
                  {missingTeachersCount}
                </strong>
              </div>

              <Button
                type="button"
                size="sm"
                disabled={bulkReminding || missingTeachersCount === 0}
                onClick={() => void handleBulkRemind()}
              >
                {bulkReminding ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BellRing className="mr-1.5 h-3.5 w-3.5" />
                )}
                Ingatkan Semua yang Belum Mengisi ({missingTeachersCount})
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {complianceLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat status pengisian jurnal guru...
              </div>
            ) : complianceList.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Belum ada akun Guru aktif yang terdaftar di sekolah ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Nama Guru</th>
                      <th className="px-4 py-3">Status Pengisian ({complianceDate})</th>
                      <th className="px-4 py-3">Status Tinjauan</th>
                      <th className="px-4 py-3 text-right">Pengingat In-App</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {complianceList.map((item) => (
                      <tr key={item.teacher_id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{item.teacher_name}</div>
                          {item.teacher_email && (
                            <div className="text-xs text-muted-foreground">
                              {item.teacher_email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.has_submitted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Sudah Mengisi ({item.journal_count} jurnal)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Belum Mengisi
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.latest_status ? (
                            <JournalStatusBadge status={item.latest_status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {item.has_submitted ? (
                            <span className="text-xs text-muted-foreground">
                              Sudah mengisi jurnal
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              {item.reminder_sent_today && (
                                <span className="text-xs text-muted-foreground">
                                  Pengingat terkirim
                                </span>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant={item.reminder_sent_today ? 'outline' : 'default'}
                                disabled={remindingTeacherId === item.teacher_id}
                                onClick={() => void handleSendReminder(item)}
                                aria-label={`Kirim pengingat ke ${item.teacher_name}`}
                              >
                                {remindingTeacherId === item.teacher_id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <BellRing className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {item.reminder_sent_today ? 'Ingatkan Lagi' : 'Kirim Pengingat'}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <JournalFormModal
        open={formOpen}
        initialData={editingJournal}
        classes={classes}
        defaultClassId={defaultGuruClassId}
        curriculumTps={curriculumTps}
        onSubmit={handleEditSubmit}
        onClose={() => {
          setFormOpen(false)
          setEditingJournal(undefined)
        }}
      />

      <JournalReviewModal
        open={Boolean(reviewingJournal)}
        journal={reviewingJournal}
        canReview={isKepsek}
        onReview={handleReview}
        onClose={() => setReviewingJournal(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingJournal)}
        recordName={
          deletingJournal
            ? `${deletingJournal.subject} — ${deletingJournal.topic} (${deletingJournal.journal_date})`
            : undefined
        }
        confirmLabel="Hapus"
        isLoading={deleteLoading}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeletingJournal(null)}
      />
    </div>
  )
}

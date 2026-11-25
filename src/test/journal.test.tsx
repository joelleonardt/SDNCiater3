import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JournalReviewModal from '@/features/journals/JournalReviewModal'
import JournalFormModal from '@/features/journals/JournalFormModal'
import JournalsPage from '@/features/journals/JournalsPage'
import JournalReminderBanner from '@/features/dashboard/JournalReminderBanner'
import { useAuthStore } from '@/stores/authStore'
import * as journalService from '@/services/journalService'
import * as classService from '@/services/classService'
import type { DailyJournalWithDetails } from '@/services/journalService'
import type { Class } from '@/types/database.types'

vi.mock('@/services/journalService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/journalService')>()
  return {
    ...actual,
    getDailyJournals: vi.fn(),
    createDailyJournal: vi.fn(),
    updateDailyJournal: vi.fn(),
    deleteDailyJournal: vi.fn(),
    reviewDailyJournal: vi.fn(),
    getTeacherJournalCompliance: vi.fn(),
    sendJournalReminder: vi.fn(),
    sendBulkJournalReminders: vi.fn(),
    getCurriculumTps: vi.fn(),
    createCurriculumTp: vi.fn(),
    deleteCurriculumTp: vi.fn(),
  }
})

vi.mock('@/services/classService', () => ({
  getClasses: vi.fn(),
}))

function makeSampleJournal(
  overrides: Partial<DailyJournalWithDetails> = {}
): DailyJournalWithDetails {
  return {
    id: 'journal-1',
    school_id: 'school-1',
    teacher_id: 'teacher-1',
    teacher_name: 'Budi Santoso, S.Pd.',
    class_id: 'class-1',
    class_name: 'Kelas 4A',
    journal_date: '2026-11-22',
    subject: 'Matematika',
    topic: 'Pecahan Senilai',
    activities: 'Penjelasan konsep pecahan senilai dengan alat peraga dan latihan soal.',
    cp: 'Peserta didik memahami konsep pecahan senilai.',
    tp: 'Menjelaskan dan menentukan pecahan senilai.',
    iktp: 'Menentukan nilai pecahan',
    method: 'Diskusi & Demonstrasi',
    media: 'Alat Peraga Pecahan',
    reflection: 'Penjelasan konsep pecahan senilai dengan alat peraga dan latihan soal.',
    status: 'Menunggu_Tinjauan',
    reviewer_id: null,
    reviewer_name: null,
    review_notes: null,
    reviewed_at: null,
    created_at: '2026-11-22T07:30:00Z',
    updated_at: '2026-11-22T07:30:00Z',
    ...overrides,
  }
}

const sampleClasses: Class[] = [
  {
    id: 'class-1',
    school_id: 'school-1',
    academic_year_id: 'ay-1',
    name: 'Kelas 4A',
    grade_level: 4,
    homeroom_teacher_id: 'teacher-1',
    created_at: '2026-07-01T00:00:00Z',
  },
]

describe('JournalReviewModal (Kepala Sekolah review flow)', () => {
  it('requires review notes when rejecting a journal and allows approval', async () => {
    const onReview = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const journal = makeSampleJournal()

    render(
      <JournalReviewModal
        open
        journal={journal}
        canReview
        onReview={onReview}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Pecahan Senilai')).toBeInTheDocument()

    // Klik Tolak Jurnal tanpa catatan -> harus muncul pesan validasi
    fireEvent.click(screen.getByRole('button', { name: /Tolak Jurnal/i }))
    expect(
      await screen.findByText(/Catatan tinjauan wajib diisi saat menolak jurnal/i)
    ).toBeInTheDocument()
    expect(onReview).not.toHaveBeenCalled()

    // Isi catatan lalu klik Tolak Jurnal
    const textarea = screen.getByLabelText(/Catatan Tinjauan Kepala Sekolah/i)
    fireEvent.change(textarea, {
      target: { value: 'Mohon lengkapi evaluasi hasil belajar siswa.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Tolak Jurnal/i }))

    await waitFor(() => {
      expect(onReview).toHaveBeenCalledWith(
        'journal-1',
        'Ditolak',
        'Mohon lengkapi evaluasi hasil belajar siswa.'
      )
    })

    // Klik Terima Jurnal
    fireEvent.click(screen.getByRole('button', { name: /Terima Jurnal/i }))
    await waitFor(() => {
      expect(onReview).toHaveBeenCalledWith(
        'journal-1',
        'Disetujui',
        'Mohon lengkapi evaluasi hasil belajar siswa.'
      )
    })
  })
})

describe('JournalFormModal (Guru create/edit flow)', () => {
  it('displays principal rejection notes when editing a rejected journal', () => {
    const rejectedJournal = makeSampleJournal({
      status: 'Ditolak',
      review_notes: 'Tambahkan rincian siswa yang memerlukan remedial.',
    })

    render(
      <JournalFormModal
        open
        initialData={rejectedJournal}
        classes={sampleClasses}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText(/Catatan Revisi Kepala Sekolah/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Tambahkan rincian siswa yang memerlukan remedial/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Simpan & Ajukan Ulang/i })
    ).toBeInTheDocument()
  })

  it('auto-fills CP when subject is selected and supports TP picker and Bersihkan TP', () => {
    render(
      <JournalFormModal
        open
        classes={sampleClasses}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />
    )

    const subjectSelect = screen.getByLabelText(/Mata Pelajaran/i) as HTMLSelectElement
    fireEvent.change(subjectSelect, { target: { value: 'Matematika' } })

    const cpTextarea = screen.getByLabelText(/Capaian Pembelajaran \(CP\)/i) as HTMLTextAreaElement
    expect(cpTextarea.value).toMatch(/pemahaman dan intuisi bilangan/i)

    const tpPicker = screen.getByLabelText(/Pilih Tujuan Pembelajaran \(TP\)/i) as HTMLSelectElement
    fireEvent.change(tpPicker, {
      target: {
        value: 'Menjelaskan dan menentukan pecahan senilai menggunakan benda konkret atau gambar.',
      },
    })

    const tpTextarea = screen.getByLabelText('Tujuan Pembelajaran (TP)') as HTMLTextAreaElement
    expect(tpTextarea.value).toContain(
      'Menjelaskan dan menentukan pecahan senilai menggunakan benda konkret atau gambar.'
    )

    fireEvent.click(screen.getByRole('button', { name: /Bersihkan TP/i }))
    expect(tpTextarea.value).toBe('')
  })
})

describe('JournalsPage (Staf Admin compliance & reminder flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: {
        id: 'admin-1',
        school_id: 'school-1',
        full_name: 'Admin Sekolah',
        email: 'admin@sdnciater3.sch.id',
        role: 'Staf_Admin',
        requested_role: null,
        avatar_url: null,
        is_active: true,
        created_at: '2026-07-01T00:00:00Z',
      },
    })
    vi.mocked(classService.getClasses).mockResolvedValue(sampleClasses)
    vi.mocked(journalService.getDailyJournals).mockResolvedValue([makeSampleJournal()])
    vi.mocked(journalService.getTeacherJournalCompliance).mockResolvedValue([
      {
        teacher_id: 'teacher-1',
        teacher_name: 'Budi Santoso, S.Pd.',
        teacher_email: 'budi@sdnciater3.sch.id',
        date: '2026-11-22',
        journal_count: 1,
        has_submitted: true,
        latest_status: 'Menunggu_Tinjauan',
        reminder_sent_today: false,
      },
      {
        teacher_id: 'teacher-2',
        teacher_name: 'Siti Aminah, S.Pd.',
        teacher_email: 'siti@sdnciater3.sch.id',
        date: '2026-11-22',
        journal_count: 0,
        has_submitted: false,
        latest_status: null,
        reminder_sent_today: false,
      },
    ])
    vi.mocked(journalService.sendJournalReminder).mockResolvedValue({
      id: 'notif-1',
      school_id: 'school-1',
      recipient_id: 'teacher-2',
      sender_id: 'admin-1',
      type: 'Pengingat_Jurnal',
      title: 'Pengingat Pengisian Jurnal Harian',
      message: 'Mohon segera mengisi Jurnal Harian mengajar Anda.',
      target_date: '2026-11-22',
      journal_id: null,
      is_read: false,
      created_at: '2026-11-22T08:00:00Z',
    })
    vi.mocked(journalService.getCurriculumTps).mockResolvedValue([])
    vi.mocked(journalService.createCurriculumTp).mockResolvedValue({
      id: 'tp-1',
      school_id: 'school-1',
      class_level: 'Kelas 4',
      subject: 'Matematika',
      tp_code: '1.1',
      semester: 'Semester 1',
      cp: 'Peserta didik memahami konsep pecahan senilai.',
      tp_description: 'Menjelaskan dan menentukan pecahan senilai dengan gambar.',
      created_by: 'admin-1',
      created_at: '2026-11-25T07:00:00Z',
    })
  })

  it('allows switching to Master Data TP (Kurikulum) tab and saving a new CP & TP item', async () => {
    render(<JournalsPage />)

    // Pindah ke tab Master Data TP (Kurikulum)
    fireEvent.click(screen.getByRole('button', { name: /Master Data TP \(Kurikulum\)/i }))

    expect(await screen.findByLabelText(/Kelas:/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Kelas:/i), { target: { value: 'Kelas 4' } })
    fireEvent.change(screen.getByLabelText(/Mata Pelajaran:/i), { target: { value: 'Matematika' } })
    fireEvent.change(screen.getByLabelText(/Kode TP:/i), { target: { value: '1.1' } })
    fireEvent.change(screen.getByLabelText(/Semester:/i), { target: { value: 'Semester 1' } })
    fireEvent.change(screen.getByLabelText(/Capaian Pembelajaran \(CP\):/i), {
      target: { value: 'Peserta didik memahami konsep pecahan senilai.' },
    })
    fireEvent.change(screen.getByLabelText(/Deskripsi Tujuan Pembelajaran \(TP\):/i), {
      target: { value: 'Menjelaskan dan menentukan pecahan senilai dengan gambar.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Simpan ke Database TP/i }))

    await waitFor(() => {
      expect(journalService.createCurriculumTp).toHaveBeenCalledWith(
        expect.objectContaining({
          school_id: 'school-1',
          class_level: 'Kelas 4',
          subject: 'Matematika',
          tp_code: '1.1',
          semester: 'Semester 1',
          cp: 'Peserta didik memahami konsep pecahan senilai.',
          tp_description: 'Menjelaskan dan menentukan pecahan senilai dengan gambar.',
        })
      )
    })
  })

  it('shows teacher submission status and allows Admin to send an in-app reminder', async () => {
    render(<JournalsPage />)

    // Pindah ke tab Pantauan & Pengingat Guru
    fireEvent.click(screen.getByRole('button', { name: /Pantauan & Pengingat Guru/i }))

    expect(await screen.findByText('Siti Aminah, S.Pd.')).toBeInTheDocument()
    expect(screen.getByText(/Sudah Mengisi \(1 jurnal\)/i)).toBeInTheDocument()
    expect(screen.getByText('Belum Mengisi')).toBeInTheDocument()

    // Klik tombol Kirim Pengingat untuk Siti Aminah
    const remindButton = screen.getByRole('button', {
      name: /Kirim pengingat ke Siti Aminah, S\.Pd\./i,
    })
    fireEvent.click(remindButton)

    await waitFor(() => {
      expect(journalService.sendJournalReminder).toHaveBeenCalledTimes(1)
      expect(journalService.sendJournalReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          school_id: 'school-1',
          sender_id: 'admin-1',
          recipient_id: 'teacher-2',
        })
      )
    })
  })

  it('displays submitted teacher journals on Dashboard for Kepala Sekolah and Staf Admin', async () => {
    useAuthStore.setState({
      profile: {
        id: 'kepsek-1',
        school_id: 'school-1',
        full_name: 'Kepala Sekolah',
        email: 'kepsek@sdnciater3.sch.id',
        role: 'Kepala_Sekolah',
        requested_role: null,
        avatar_url: null,
        is_active: true,
        created_at: '2026-07-01T00:00:00Z',
      },
    })

    render(
      <MemoryRouter>
        <JournalReminderBanner />
      </MemoryRouter>
    )

    expect(await screen.findByText('Jurnal Harian Guru Terbaru')).toBeInTheDocument()
    expect(screen.getByText('Budi Santoso, S.Pd.')).toBeInTheDocument()
    expect(screen.getByText('Pecahan Senilai')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tinjau/i })).toBeInTheDocument()
  })
})

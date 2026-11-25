/**
 * journalService.ts — Layanan Jurnal Harian Guru, Tinjauan Kepala Sekolah,
 * Pantauan Kepatuhan Guru, dan Notifikasi Pengingat In-App.
 *
 * Semua pemanggilan Supabase client untuk domain jurnal & notifikasi
 * diisolasi di file ini (Requirement 16.3, 17.1–17.9).
 */

import { supabase } from './supabase'
import { escapeHtml, printHTML } from '@/lib/pdfGenerator'
import { formatReportDate, formatNumber } from '@/lib/utils'
import type {
  AppNotification,
  Class,
  DailyJournal,
  Profile,
} from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type JournalStatus = 'Menunggu_Tinjauan' | 'Disetujui' | 'Ditolak'

export interface ParsedJournalFields {
  cp: string
  tp: string
  iktp: string
  method: string
  media: string
  reflection: string
}

export interface DailyJournalWithDetails extends DailyJournal, ParsedJournalFields {
  teacher_name: string
  class_name: string
  reviewer_name: string | null
}

export interface CreateDailyJournalInput {
  school_id: string
  teacher_id: string
  class_id: string
  journal_date: string
  subject: string
  topic: string
  activities: string
  cp?: string
  tp?: string
  iktp?: string
  method?: string
  media?: string
}

export interface UpdateDailyJournalInput {
  class_id: string
  journal_date: string
  subject: string
  topic: string
  activities: string
  cp?: string
  tp?: string
  iktp?: string
  method?: string
  media?: string
}

// ─── Preset Kurikulum Merdeka SD (Mata Pelajaran, CP, & Pilihan TP) ──────────

export interface SubjectCurriculumPreset {
  subject: string
  defaultCp: string
  tpOptions: string[]
}

export const SD_CURRICULUM_PRESETS: SubjectCurriculumPreset[] = [
  {
    subject: 'Matematika',
    defaultCp:
      'Peserta didik menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah, pecahan, operasi hitung, pengukuran, geometri, serta analisis data sederhana dalam kehidupan sehari-hari.',
    tpOptions: [
      'Menjelaskan dan menentukan pecahan senilai menggunakan benda konkret atau gambar.',
      'Melakukan operasi penjumlahan dan pengurangan bilangan cacah serta pecahan.',
      'Mengukur dan membandingkan panjang, berat, waktu, serta luas bangun datar.',
      'Mengidentifikasi ciri-ciri bangun datar dan bangun ruang sederhana.',
    ],
  },
  {
    subject: 'Bahasa Indonesia',
    defaultCp:
      'Peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar melalui kegiatan menyimak, membaca dan memirsa, berbicara dan mempresentasikan, serta menulis berbagai teks.',
    tpOptions: [
      'Menemukan ide pokok dan informasi penting dari teks bacaan narasi/informatif.',
      'Menulis kalimat efektif dan paragraf deskripsi menggunakan kosakata baku.',
      'Menceritakan kembali isi teks yang dibaca atau disimak dengan bahasa sendiri.',
      'Mengidentifikasi unsur intrinsik cerita anak (tokoh, watak, latar, amanat).',
    ],
  },
  {
    subject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
    defaultCp:
      'Peserta didik memahami fenomena alam dan sosial di sekitar, keterkaitan makhluk hidup dengan lingkungannya, wujud zat dan energi, serta keragaman budaya dan kegiatan ekonomi masyarakat.',
    tpOptions: [
      'Mengidentifikasi bagian tubuh tumbuhan/hewan beserta fungsinya bagi kelangsungan hidup.',
      'Menjelaskan perubahan wujud benda dan pemanfaatan bentuk energi dalam kehidupan sehari-hari.',
      'Mendeskripsikan keragaman sosial, budaya, dan kenampakan alam di lingkungan sekitar.',
      'Menjelaskan siklus air dan upaya menjaga kelestarian sumber daya alam.',
    ],
  },
  {
    subject: 'Pendidikan Pancasila',
    defaultCp:
      'Peserta didik mampu memahami dan menerapkan nilai-nilai Pancasila, aturan dan norma di keluarga/sekolah, hak dan kewajiban, serta menghargai Bhinneka Tunggal Ika dalam bingkai NKRI.',
    tpOptions: [
      'Menerapkan nilai-nilai sila Pancasila dalam kehidupan sehari-hari di sekolah dan rumah.',
      'Mengidentifikasi aturan, hak, dan kewajiban sebagai anggota keluarga dan warga sekolah.',
      'Menunjukkan sikap menghargai keberagaman suku, agama, dan budaya teman di kelas.',
      'Mempraktikkan musyawarah mufakat dalam mengambil keputusan bersama di kelas.',
    ],
  },
  {
    subject: 'Pendidikan Agama dan Budi Pekerti',
    defaultCp:
      'Peserta didik memahami ajaran agama, menerapkan akhlak mulia, jujur, disiplin, santun, serta peduli terhadap sesama dan lingkungan.',
    tpOptions: [
      'Mempraktikkan perilaku jujur, santun, dan hormat kepada orang tua serta guru.',
      'Memahami makna doa dan ibadah harian beserta penerapannya dalam keseharian.',
      'Menunjukkan sikap saling menolong dan toleransi terhadap sesama teman.',
    ],
  },
  {
    subject: 'Seni dan Budaya',
    defaultCp:
      'Peserta didik mampu mengamati, mengenal, merasakan, dan menciptakan karya seni rupa, musik, tari, atau keterampilan secara kreatif dan ekspresif.',
    tpOptions: [
      'Mengenal dan membuat karya seni rupa dua dimensi menggunakan unsur garis, bentuk, dan warna.',
      'Menyanyikan lagu daerah/nasional dengan memperhatikan tinggi rendah nada dan tempo.',
      'Membuat karya kerajinan sederhana dari bahan alam atau bahan daur ulang.',
    ],
  },
  {
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    defaultCp:
      'Peserta didik menunjukkan kemampuan dalam mempraktikkan variasi dan kombinasi pola gerak dasar lokomotor, non-lokomotor, manipulatif, serta perilaku hidup bersih dan sehat.',
    tpOptions: [
      'Mempraktikkan kombinasi gerak dasar lokomotor (jalan, lari, lompat) dalam permainan sederhana.',
      'Mempraktikkan gerak dasar manipulatif (melempar, menangkap, menendang bola) secara sportif.',
      'Menjelaskan cara menjaga kebersihan diri dan kesehatan tubuh sehari-hari.',
    ],
  },
  {
    subject: 'Bahasa Inggris',
    defaultCp:
      'Peserta didik menggunakan bahasa Inggris sederhana untuk berinteraksi dalam situasi sosial dan kelas yang familier melalui kegiatan menyimak, berbicara, membaca, dan menulis.',
    tpOptions: [
      'Memperkenalkan diri dan menggunakan ungkapan sapaan (greetings) dalam bahasa Inggris.',
      'Menyebutkan kosakata benda-benda di dalam kelas, angka, warna, dan anggota keluarga.',
      'Merangkai kalimat sederhana tentang kegiatan sehari-hari (daily activities).',
    ],
  },
  {
    subject: 'Muatan Lokal / Bahasa Daerah',
    defaultCp:
      'Peserta didik mengenal, memahami, dan melestarikan bahasa serta kearifan budaya lokal dalam komunikasi sehari-hari secara santun.',
    tpOptions: [
      'Menggunakan ragam bahasa daerah yang santun dalam percakapan sehari-hari.',
      'Mengenal kesenian, permainan tradisional, dan budaya daerah setempat.',
    ],
  },
]

export function serializeJournalActivities(input: {
  cp?: string
  tp?: string
  iktp?: string
  method?: string
  media?: string
  activities: string
}): string {
  const cp = input.cp?.trim() ?? ''
  const tp = input.tp?.trim() ?? ''
  const iktp = input.iktp?.trim() ?? ''
  const method = input.method?.trim() ?? ''
  const media = input.media?.trim() ?? ''
  const reflection = input.activities.trim()

  if (!cp && !tp && !iktp && !method && !media) {
    return reflection.slice(0, 2000)
  }

  const lines: string[] = []
  if (cp) lines.push(`[CP]: ${cp}`)
  if (tp) lines.push(`[TP]: ${tp}`)
  if (iktp) lines.push(`[IKTP]: ${iktp}`)
  if (method) lines.push(`[Metode]: ${method}`)
  if (media) lines.push(`[Media]: ${media}`)
  lines.push(`[Refleksi]: ${reflection}`)

  return lines.join('\n').slice(0, 2000)
}

export function parseJournalActivities(rawActivities: string): ParsedJournalFields {
  if (!rawActivities || !rawActivities.includes('[Refleksi]:')) {
    return {
      cp: '',
      tp: '',
      iktp: '',
      method: '',
      media: '',
      reflection: rawActivities ?? '',
    }
  }

  function extractTag(tag: string, nextTags: string[]): string {
    const startToken = `[${tag}]:`
    const startIdx = rawActivities.indexOf(startToken)
    if (startIdx === -1) return ''
    const contentStart = startIdx + startToken.length
    let endIdx = rawActivities.length
    for (const nextTag of nextTags) {
      const nextPos = rawActivities.indexOf(`\n[${nextTag}]:`, contentStart)
      if (nextPos !== -1 && nextPos < endIdx) {
        endIdx = nextPos
      }
    }
    return rawActivities.slice(contentStart, endIdx).trim()
  }

  return {
    cp: extractTag('CP', ['TP', 'IKTP', 'Metode', 'Media', 'Refleksi']),
    tp: extractTag('TP', ['IKTP', 'Metode', 'Media', 'Refleksi']),
    iktp: extractTag('IKTP', ['Metode', 'Media', 'Refleksi']),
    method: extractTag('Metode', ['Media', 'Refleksi']),
    media: extractTag('Media', ['Refleksi']),
    reflection: extractTag('Refleksi', []),
  }
}

export interface ReviewDailyJournalInput {
  journal_id: string
  reviewer_id: string
  status: 'Disetujui' | 'Ditolak'
  review_notes?: string | null
}

export interface TeacherJournalComplianceItem {
  teacher_id: string
  teacher_name: string
  teacher_email: string | null
  date: string
  journal_count: number
  has_submitted: boolean
  latest_status: JournalStatus | null
  reminder_sent_today: boolean
}

export interface SendJournalReminderInput {
  school_id: string
  sender_id: string
  recipient_id: string
  target_date: string
  custom_message?: string
}

export const NOTIFICATIONS_UPDATED_EVENT = 'sekolah-admin:notifications-updated'

function emitNotificationsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT))
  }
}

// ─── LocalStorage Fallback (digunakan hanya bila tabel SQL belum dimigrasikan) ─

const LS_JOURNALS_KEY = 'sekolah_admin_daily_journals_v1'
const LS_NOTIFICATIONS_KEY = 'sekolah_admin_notifications_v1'

let usingLocalJournalFallback = false

export function isUsingLocalJournalFallback(): boolean {
  return usingLocalJournalFallback
}

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = err.code ?? ''
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  )
}

function readLocalJournals(): DailyJournal[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_JOURNALS_KEY)
    return raw ? (JSON.parse(raw) as DailyJournal[]) : []
  } catch {
    return []
  }
}

function writeLocalJournals(items: DailyJournal[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_JOURNALS_KEY, JSON.stringify(items))
  } catch {
    // Abaikan quota error
  }
}

function readLocalNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_NOTIFICATIONS_KEY)
    return raw ? (JSON.parse(raw) as AppNotification[]) : []
  } catch {
    return []
  }
}

function writeLocalNotifications(items: AppNotification[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_NOTIFICATIONS_KEY, JSON.stringify(items))
  } catch {
    // Abaikan quota error
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatIndonesianDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

// ─── Helper Lookup Nama Guru & Kelas ─────────────────────────────────────────

async function fetchProfilesAndClassesMap(): Promise<{
  profileMap: Map<string, string>
  classMap: Map<string, string>
}> {
  const [profilesRes, classesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name'),
    supabase.from('classes').select('id, name'),
  ])

  const profileMap = new Map<string, string>()
  for (const p of (profilesRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[]) {
    profileMap.set(p.id, p.full_name)
  }

  const classMap = new Map<string, string>()
  for (const c of (classesRes.data ?? []) as Pick<Class, 'id' | 'name'>[]) {
    classMap.set(c.id, c.name)
  }

  return { profileMap, classMap }
}

// ─── CRUD Jurnal Harian ──────────────────────────────────────────────────────

export interface GetDailyJournalsParams {
  schoolId: string
  teacherId?: string
  classId?: string
  status?: JournalStatus | ''
  startDate?: string
  endDate?: string
}

export async function getDailyJournals(
  params: GetDailyJournalsParams
): Promise<DailyJournalWithDetails[]> {
  let query = supabase
    .from('daily_journals')
    .select('*')
    .order('journal_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.teacherId) {
    query = query.eq('teacher_id', params.teacherId)
  }
  if (params.classId) {
    query = query.eq('class_id', params.classId)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.startDate) {
    query = query.gte('journal_date', params.startDate)
  }
  if (params.endDate) {
    query = query.lte('journal_date', params.endDate)
  }

  const { data, error } = await query
  const { profileMap, classMap } = await fetchProfilesAndClassesMap()

  let rows: DailyJournal[] = []
  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    usingLocalJournalFallback = true
    rows = readLocalJournals().filter((j) => {
      if (params.teacherId && j.teacher_id !== params.teacherId) return false
      if (params.classId && j.class_id !== params.classId) return false
      if (params.status && j.status !== params.status) return false
      if (params.startDate && j.journal_date < params.startDate) return false
      if (params.endDate && j.journal_date > params.endDate) return false
      return true
    })
    rows.sort((a, b) =>
      b.journal_date.localeCompare(a.journal_date) ||
      b.created_at.localeCompare(a.created_at)
    )
  } else {
    usingLocalJournalFallback = false
    rows = (data ?? []) as DailyJournal[]
  }

  return rows.map((row) => {
    const parsed = parseJournalActivities(row.activities)
    return {
      ...row,
      ...parsed,
      teacher_name: profileMap.get(row.teacher_id) ?? 'Guru',
      class_name: classMap.get(row.class_id) ?? 'Kelas',
      reviewer_name: row.reviewer_id
        ? (profileMap.get(row.reviewer_id) ?? 'Kepala Sekolah')
        : null,
    }
  })
}

export async function createDailyJournal(
  input: CreateDailyJournalInput
): Promise<DailyJournal> {
  const serializedActivities = serializeJournalActivities({
    cp: input.cp,
    tp: input.tp,
    iktp: input.iktp,
    method: input.method,
    media: input.media,
    activities: input.activities,
  })

  const payload = {
    school_id: input.school_id,
    teacher_id: input.teacher_id,
    class_id: input.class_id,
    journal_date: input.journal_date,
    subject: input.subject.trim(),
    topic: input.topic.trim(),
    activities: serializedActivities,
    status: 'Menunggu_Tinjauan' as const,
  }

  const { data, error } = await db
    .from('daily_journals')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const now = new Date().toISOString()
    const fallbackItem: DailyJournal = {
      id: generateId(),
      ...payload,
      reviewer_id: null,
      review_notes: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now,
    }
    const current = readLocalJournals()
    writeLocalJournals([fallbackItem, ...current])
    emitNotificationsUpdated()
    return fallbackItem
  }

  emitNotificationsUpdated()
  return data as DailyJournal
}

export async function updateDailyJournal(
  id: string,
  input: UpdateDailyJournalInput
): Promise<DailyJournal> {
  const now = new Date().toISOString()
  const serializedActivities = serializeJournalActivities({
    cp: input.cp,
    tp: input.tp,
    iktp: input.iktp,
    method: input.method,
    media: input.media,
    activities: input.activities,
  })

  const payload = {
    class_id: input.class_id,
    journal_date: input.journal_date,
    subject: input.subject.trim(),
    topic: input.topic.trim(),
    activities: serializedActivities,
    status: 'Menunggu_Tinjauan' as const,
    reviewer_id: null,
    review_notes: null,
    reviewed_at: null,
    updated_at: now,
  }

  const { data, error } = await db
    .from('daily_journals')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const current = readLocalJournals()
    const idx = current.findIndex((j) => j.id === id)
    if (idx === -1) {
      throw new Error('Jurnal harian tidak ditemukan.')
    }
    const updated: DailyJournal = {
      ...current[idx],
      ...payload,
    }
    current[idx] = updated
    writeLocalJournals(current)
    emitNotificationsUpdated()
    return updated
  }

  emitNotificationsUpdated()
  return data as DailyJournal
}

export async function deleteDailyJournal(id: string): Promise<void> {
  const { error } = await supabase
    .from('daily_journals')
    .delete()
    .eq('id', id)

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const current = readLocalJournals()
    writeLocalJournals(current.filter((j) => j.id !== id))
    emitNotificationsUpdated()
    return
  }

  emitNotificationsUpdated()
}

// ─── Tinjauan Kepala Sekolah (Disetujui / Ditolak) ───────────────────────────

export async function reviewDailyJournal(
  input: ReviewDailyJournalInput
): Promise<DailyJournal> {
  const trimmedNotes = input.review_notes?.trim() ?? null
  if (input.status === 'Ditolak' && !trimmedNotes) {
    throw new Error('Catatan tinjauan wajib diisi saat menolak jurnal harian.')
  }

  const now = new Date().toISOString()
  const updatePayload = {
    status: input.status,
    reviewer_id: input.reviewer_id,
    review_notes: trimmedNotes,
    reviewed_at: now,
    updated_at: now,
  }

  const { data, error } = await db
    .from('daily_journals')
    .update(updatePayload)
    .eq('id', input.journal_id)
    .select('*')
    .single()

  let updatedJournal: DailyJournal

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const current = readLocalJournals()
    const idx = current.findIndex((j) => j.id === input.journal_id)
    if (idx === -1) {
      throw new Error('Jurnal harian tidak ditemukan.')
    }
    updatedJournal = {
      ...current[idx],
      ...updatePayload,
    }
    current[idx] = updatedJournal
    writeLocalJournals(current)
  } else {
    updatedJournal = data as DailyJournal
  }

  // Kirim notifikasi hasil tinjauan ke Guru pemilik jurnal
  const statusLabel = input.status === 'Disetujui' ? 'Disetujui' : 'Ditolak'
  const dateLabel = formatIndonesianDate(updatedJournal.journal_date)
  const noteSuffix = trimmedNotes ? ` Catatan: "${trimmedNotes}"` : ''

  await createInAppNotification({
    school_id: updatedJournal.school_id,
    recipient_id: updatedJournal.teacher_id,
    sender_id: input.reviewer_id,
    type: 'Tinjauan_Jurnal',
    title: `Jurnal Harian ${statusLabel}`,
    message: `Jurnal ${updatedJournal.subject} (${dateLabel}) telah ${statusLabel.toLowerCase()} oleh Kepala Sekolah.${noteSuffix}`.slice(
      0,
      500
    ),
    target_date: updatedJournal.journal_date,
    journal_id: updatedJournal.id,
  })

  emitNotificationsUpdated()
  return updatedJournal
}

// ─── Pantauan Kepatuhan Guru & Pengingat Admin ───────────────────────────────

export async function getTeacherJournalCompliance(
  schoolId: string,
  date: string
): Promise<TeacherJournalComplianceItem[]> {
  const { data: teachersData, error: teachersError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('school_id', schoolId)
    .eq('role', 'Guru')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (teachersError) {
    throw new Error(teachersError.message)
  }

  const teachers = (teachersData ?? []) as Pick<
    Profile,
    'id' | 'full_name' | 'email' | 'role' | 'is_active'
  >[]

  // Ambil jurnal pada tanggal terkait
  const { data: journalsData, error: journalsError } = await supabase
    .from('daily_journals')
    .select('*')
    .eq('journal_date', date)

  let journalsOnDate: DailyJournal[] = []
  if (journalsError) {
    if (!isMissingTableError(journalsError)) {
      throw new Error(journalsError.message)
    }
    usingLocalJournalFallback = true
    journalsOnDate = readLocalJournals().filter((j) => j.journal_date === date)
  } else {
    usingLocalJournalFallback = false
    journalsOnDate = (journalsData ?? []) as DailyJournal[]
  }

  // Ambil pengingat yang sudah dikirim untuk target_date tersebut
  const { data: notifData, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .eq('school_id', schoolId)
    .eq('type', 'Pengingat_Jurnal')
    .eq('target_date', date)

  let remindersOnDate: AppNotification[] = []
  if (notifError) {
    if (!isMissingTableError(notifError)) {
      throw new Error(notifError.message)
    }
    remindersOnDate = readLocalNotifications().filter(
      (n) =>
        n.school_id === schoolId &&
        n.type === 'Pengingat_Jurnal' &&
        n.target_date === date
    )
  } else {
    remindersOnDate = (notifData ?? []) as AppNotification[]
  }

  const remindedSet = new Set(remindersOnDate.map((n) => n.recipient_id))

  return teachers.map((teacher) => {
    const teacherJournals = journalsOnDate.filter((j) => j.teacher_id === teacher.id)
    const latest = teacherJournals[0] ?? null
    return {
      teacher_id: teacher.id,
      teacher_name: teacher.full_name,
      teacher_email: teacher.email,
      date,
      journal_count: teacherJournals.length,
      has_submitted: teacherJournals.length > 0,
      latest_status: latest ? latest.status : null,
      reminder_sent_today: remindedSet.has(teacher.id),
    }
  })
}

async function createInAppNotification(input: {
  school_id: string
  recipient_id: string
  sender_id: string | null
  type: 'Pengingat_Jurnal' | 'Tinjauan_Jurnal'
  title: string
  message: string
  target_date: string | null
  journal_id: string | null
}): Promise<AppNotification> {
  const payload = {
    school_id: input.school_id,
    recipient_id: input.recipient_id,
    sender_id: input.sender_id,
    type: input.type,
    title: input.title,
    message: input.message,
    target_date: input.target_date,
    journal_id: input.journal_id,
    is_read: false,
  }

  const { data, error } = await db
    .from('notifications')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const fallbackNotif: AppNotification = {
      id: generateId(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    const current = readLocalNotifications()
    writeLocalNotifications([fallbackNotif, ...current])
    emitNotificationsUpdated()
    return fallbackNotif
  }

  emitNotificationsUpdated()
  return data as AppNotification
}

export async function sendJournalReminder(
  input: SendJournalReminderInput
): Promise<AppNotification> {
  const dateLabel = formatIndonesianDate(input.target_date)
  const message =
    input.custom_message?.trim() ||
    `Mohon segera mengisi Jurnal Harian mengajar Anda untuk tanggal ${dateLabel}.`

  return createInAppNotification({
    school_id: input.school_id,
    recipient_id: input.recipient_id,
    sender_id: input.sender_id,
    type: 'Pengingat_Jurnal',
    title: 'Pengingat Pengisian Jurnal Harian',
    message,
    target_date: input.target_date,
    journal_id: null,
  })
}

export async function sendBulkJournalReminders(params: {
  school_id: string
  sender_id: string
  recipient_ids: string[]
  target_date: string
}): Promise<number> {
  const uniqueIds = Array.from(new Set(params.recipient_ids))
  if (uniqueIds.length === 0) return 0

  for (const recipientId of uniqueIds) {
    await sendJournalReminder({
      school_id: params.school_id,
      sender_id: params.sender_id,
      recipient_id: recipientId,
      target_date: params.target_date,
    })
  }
  return uniqueIds.length
}

// ─── Notifikasi untuk Guru (Topbar & Dashboard) ──────────────────────────────

export async function getMyNotifications(
  recipientId: string,
  limit = 15
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    return readLocalNotifications()
      .filter((n) => n.recipient_id === recipientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }

  return (data ?? []) as AppNotification[]
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const current = readLocalNotifications().map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    )
    writeLocalNotifications(current)
    emitNotificationsUpdated()
    return
  }

  emitNotificationsUpdated()
}

export async function markAllNotificationsAsRead(recipientId: string): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', recipientId)
    .eq('is_read', false)

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const current = readLocalNotifications().map((n) =>
      n.recipient_id === recipientId ? { ...n, is_read: true } : n
    )
    writeLocalNotifications(current)
    emitNotificationsUpdated()
    return
  }

  emitNotificationsUpdated()
}

export async function hasTeacherSubmittedJournalOnDate(
  schoolId: string,
  teacherId: string,
  date: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('daily_journals')
    .select('id')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('journal_date', date)
    .limit(1)

  if (error) {
    if (!isMissingTableError(error)) {
      return false
    }
    return readLocalJournals().some(
      (j) =>
        j.teacher_id === teacherId &&
        j.journal_date === date
    )
  }

  return (data ?? []).length > 0
}

// ─── Cetak Jurnal Pembelajaran (PDF / Print Browser) ─────────────────────────

export function printDailyJournalsPdf(
  journals: DailyJournalWithDetails[],
  options: {
    startDate?: string
    endDate?: string
    schoolName?: string
  } = {}
): void {
  if (journals.length === 0) {
    throw new Error('Tidak ada data jurnal pembelajaran pada rentang tanggal yang dipilih.')
  }

  const schoolName = escapeHtml(options.schoolName ?? 'SDN Ciater 03')
  const periodLabel =
    options.startDate && options.endDate
      ? `${escapeHtml(formatReportDate(options.startDate))} s/d ${escapeHtml(formatReportDate(options.endDate))}`
      : options.startDate
        ? `Mulai ${escapeHtml(formatReportDate(options.startDate))}`
        : 'Semua Periode'

  const rows = journals
    .map((j, idx) => {
      const statusText =
        j.status === 'Disetujui'
          ? 'Disetujui'
          : j.status === 'Ditolak'
            ? 'Ditolak'
            : 'Menunggu Tinjauan'
      return `
      <tr>
        <td style="text-align:center">${formatNumber(idx + 1)}</td>
        <td>${escapeHtml(j.journal_date)}</td>
        <td>${escapeHtml(j.teacher_name)}</td>
        <td style="text-align:center">${escapeHtml(j.class_name)}</td>
        <td><strong>${escapeHtml(j.subject)}</strong><br/><span>Materi: ${escapeHtml(j.topic)}</span></td>
        <td>
          ${j.cp ? `<div><strong>CP:</strong> ${escapeHtml(j.cp)}</div>` : ''}
          ${j.tp ? `<div><strong>TP:</strong> ${escapeHtml(j.tp)}</div>` : ''}
          ${j.iktp ? `<div><strong>IKTP:</strong> ${escapeHtml(j.iktp)}</div>` : ''}
        </td>
        <td>
          ${j.method ? `<div><strong>Metode:</strong> ${escapeHtml(j.method)}</div>` : ''}
          ${j.media ? `<div><strong>Media:</strong> ${escapeHtml(j.media)}</div>` : ''}
          <div><strong>Refleksi:</strong> ${escapeHtml(j.reflection || j.activities)}</div>
        </td>
        <td style="text-align:center">
          <strong>${escapeHtml(statusText)}</strong>
          ${j.review_notes ? `<br/><small>Catatan: ${escapeHtml(j.review_notes)}</small>` : ''}
        </td>
      </tr>`
    })
    .join('')

  const html = `
    <h1>${schoolName} — Laporan Jurnal Pembelajaran Harian</h1>
    <p class="meta">Periode: ${periodLabel} | Total Jurnal: ${formatNumber(journals.length)}</p>
    <table>
      <thead>
        <tr>
          <th style="width:28px">No</th>
          <th style="width:78px">Tanggal</th>
          <th style="width:110px">Guru</th>
          <th style="width:55px">Kelas</th>
          <th style="width:130px">Mapel &amp; Materi Pokok</th>
          <th>CP, TP &amp; Indikator (IKTP)</th>
          <th>Metode, Media &amp; Refleksi</th>
          <th style="width:95px">Status Tinjauan</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="meta" style="margin-top:16px">Dicetak pada: ${escapeHtml(formatReportDate(new Date()))}</p>
  `

  printHTML(html, 'Laporan Jurnal Pembelajaran')
}

// ─── Master Data TP (Kurikulum) — Capaian Pembelajaran & Tujuan Pembelajaran ─

export interface CurriculumTpItem {
  id: string
  school_id: string
  class_level: string
  subject: string
  tp_code: string
  semester: 'Semester 1' | 'Semester 2'
  cp: string
  tp_description: string
  created_by: string | null
  created_at: string
}

export interface CreateCurriculumTpInput {
  school_id: string
  class_level: string
  subject: string
  tp_code: string
  semester: 'Semester 1' | 'Semester 2'
  cp: string
  tp_description: string
  created_by?: string | null
}

const LS_CURRICULUM_TPS_KEY = 'sekolah_admin_curriculum_tps_v1'

function readLocalCurriculumTps(): CurriculumTpItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_CURRICULUM_TPS_KEY)
    return raw ? (JSON.parse(raw) as CurriculumTpItem[]) : []
  } catch {
    return []
  }
}

function writeLocalCurriculumTps(items: CurriculumTpItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_CURRICULUM_TPS_KEY, JSON.stringify(items))
  } catch {
    // Abaikan quota error
  }
}

export async function getCurriculumTps(schoolId?: string): Promise<CurriculumTpItem[]> {
  const { data, error } = await db
    .from('curriculum_tps')
    .select('*')
    .order('class_level', { ascending: true })
    .order('subject', { ascending: true })
    .order('tp_code', { ascending: true })

  const localItems = readLocalCurriculumTps()

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    return schoolId
      ? localItems.filter((item) => !item.school_id || item.school_id === schoolId)
      : localItems
  }

  const dbItems = (data ?? []) as CurriculumTpItem[]
  const dbIds = new Set(dbItems.map((i) => i.id))
  const merged = [...dbItems, ...localItems.filter((l) => !dbIds.has(l.id))]
  return merged
}

export async function createCurriculumTp(
  input: CreateCurriculumTpInput
): Promise<CurriculumTpItem> {
  const payload = {
    school_id: input.school_id,
    class_level: input.class_level.trim(),
    subject: input.subject.trim(),
    tp_code: input.tp_code.trim(),
    semester: input.semester,
    cp: input.cp.trim(),
    tp_description: input.tp_description.trim(),
    created_by: input.created_by ?? null,
  }

  const { data, error } = await db
    .from('curriculum_tps')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    const fallbackItem: CurriculumTpItem = {
      id: generateId(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    const current = readLocalCurriculumTps()
    writeLocalCurriculumTps([fallbackItem, ...current])
    return fallbackItem
  }

  return data as CurriculumTpItem
}

export async function deleteCurriculumTp(id: string): Promise<void> {
  const currentLocal = readLocalCurriculumTps()
  if (currentLocal.some((i) => i.id === id)) {
    writeLocalCurriculumTps(currentLocal.filter((i) => i.id !== id))
  }

  const { error } = await db
    .from('curriculum_tps')
    .delete()
    .eq('id', id)

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message)
  }
}

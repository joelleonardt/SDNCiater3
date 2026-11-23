/**
 * journalService.ts — Layanan Jurnal Harian Guru, Tinjauan Kepala Sekolah,
 * Pantauan Kepatuhan Guru, dan Notifikasi Pengingat In-App.
 *
 * Semua pemanggilan Supabase client untuk domain jurnal & notifikasi
 * diisolasi di file ini (Requirement 16.3, 17.1–17.9).
 */

import { supabase } from './supabase'
import type {
  AppNotification,
  Class,
  DailyJournal,
  Profile,
} from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type JournalStatus = 'Menunggu_Tinjauan' | 'Disetujui' | 'Ditolak'

export interface DailyJournalWithDetails extends DailyJournal {
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
}

export interface UpdateDailyJournalInput {
  class_id: string
  journal_date: string
  subject: string
  topic: string
  activities: string
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

async function fetchProfilesAndClassesMap(schoolId: string): Promise<{
  profileMap: Map<string, string>
  classMap: Map<string, string>
}> {
  const [profilesRes, classesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('school_id', schoolId),
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId),
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
    .eq('school_id', params.schoolId)
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
  const { profileMap, classMap } = await fetchProfilesAndClassesMap(params.schoolId)

  let rows: DailyJournal[] = []
  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(error.message)
    }
    rows = readLocalJournals().filter((j) => {
      if (j.school_id !== params.schoolId) return false
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
    rows = (data ?? []) as DailyJournal[]
  }

  return rows.map((row) => ({
    ...row,
    teacher_name: profileMap.get(row.teacher_id) ?? 'Guru',
    class_name: classMap.get(row.class_id) ?? 'Kelas',
    reviewer_name: row.reviewer_id ? (profileMap.get(row.reviewer_id) ?? 'Kepala Sekolah') : null,
  }))
}

export async function createDailyJournal(
  input: CreateDailyJournalInput
): Promise<DailyJournal> {
  const payload = {
    school_id: input.school_id,
    teacher_id: input.teacher_id,
    class_id: input.class_id,
    journal_date: input.journal_date,
    subject: input.subject.trim(),
    topic: input.topic.trim(),
    activities: input.activities.trim(),
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
  const payload = {
    class_id: input.class_id,
    journal_date: input.journal_date,
    subject: input.subject.trim(),
    topic: input.topic.trim(),
    activities: input.activities.trim(),
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
    .eq('school_id', schoolId)
    .eq('journal_date', date)

  let journalsOnDate: DailyJournal[] = []
  if (journalsError) {
    if (!isMissingTableError(journalsError)) {
      throw new Error(journalsError.message)
    }
    journalsOnDate = readLocalJournals().filter(
      (j) => j.school_id === schoolId && j.journal_date === date
    )
  } else {
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
        j.school_id === schoolId &&
        j.teacher_id === teacherId &&
        j.journal_date === date
    )
  }

  return (data ?? []).length > 0
}

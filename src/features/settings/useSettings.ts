import { useCallback, useEffect, useState } from 'react'
import type { Profile, School, AcademicYear, GradeScale } from '@/types/database.types'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useToast } from '@/components/ui/Toast/useToast'
import {
  updateProfile as svcUpdateProfile,
  uploadAvatar as svcUploadAvatar,
  updatePassword as svcUpdatePassword,
  getSchool,
  updateSchool as svcUpdateSchool,
  getAcademicYears,
  createAcademicYear as svcCreateAcademicYear,
  setActiveAcademicYear as svcSetActiveAcademicYear,
  getGradeScales,
  saveGradeScales as svcSaveGradeScales,
} from '@/services/settingsService'

function formatSettingsError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : ''
  if (raw.toLowerCase().includes('failed to fetch') || raw.toLowerCase().includes('networkerror')) {
    return 'Koneksi ke server Supabase terputus. Periksa jaringan internet Anda lalu klik Muat Ulang.'
  }
  return raw || fallback
}

export interface UseSettingsOptions {
  /** Muat data sekolah, tahun ajaran, dan skala nilai (default: true). */
  fetchSchoolData?: boolean
}

export function useSettings(options: UseSettingsOptions = {}) {
  const { fetchSchoolData = true } = options
  const storeProfile = useAuthStore((s) => s.profile)
  const setSession = useAuthStore((s) => s.setSession)
  const session = useAuthStore((s) => s.session)
  const setStoreActiveAcademicYear = useAppStore((s) => s.setActiveAcademicYear)
  const setStoreActiveSemester = useAppStore((s) => s.setActiveSemester)
  const { toastSuccess, toastError } = useToast()

  const schoolId = storeProfile?.school_id ?? null
  const userId = storeProfile?.id ?? null

  const [profile, setProfile] = useState<Profile | null>(storeProfile)
  const [school, setSchool] = useState<School | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1)
  }, [])

  // Sinkronisasi profile dari store saat store berubah
  useEffect(() => {
    setProfile(storeProfile)
  }, [storeProfile])

  // Muat data sekolah, tahun ajaran, dan skala nilai saat mount / schoolId berubah
  useEffect(() => {
    if (!schoolId || !fetchSchoolData) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    Promise.all([
      getSchool(schoolId),
      getAcademicYears(schoolId),
      getGradeScales(schoolId),
    ])
      .then(([schoolData, years, scales]) => {
        if (cancelled) return
        setSchool(schoolData)
        setAcademicYears(years)
        setGradeScales(scales)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = formatSettingsError(err, 'Gagal memuat pengaturan')
        setLoadError(msg)
        toastError('Gagal memuat pengaturan', msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, fetchSchoolData, reloadTick, toastError])

  // ─── Profile ───────────────────────────────────────────────────────────────

  const updateProfile = useCallback(
    async (data: { full_name?: string; avatar_url?: string }) => {
      if (!userId) return
      try {
        const updated = await svcUpdateProfile(userId, data)
        setProfile(updated)
        // Perbarui profile di authStore agar Topbar & komponen lain ikut sinkron
        if (session) setSession(session, updated)
        toastSuccess('Profil berhasil diperbarui')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui profil'
        toastError('Gagal memperbarui profil', msg)
        throw err
      }
    },
    [userId, session, setSession, toastSuccess, toastError]
  )

  const uploadAvatar = useCallback(
    async (file: File): Promise<string> => {
      if (!userId) throw new Error('Pengguna belum terautentikasi')
      try {
        const publicUrl = await svcUploadAvatar(userId, file)
        const updated = await svcUpdateProfile(userId, { avatar_url: publicUrl })
        setProfile(updated)
        if (session) setSession(session, updated)
        toastSuccess('Foto profil berhasil diperbarui')
        return publicUrl
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto profil'
        toastError('Gagal mengunggah foto profil', msg)
        throw err
      }
    },
    [userId, session, setSession, toastSuccess, toastError]
  )

  const updatePassword = useCallback(
    async (newPassword: string) => {
      try {
        await svcUpdatePassword(newPassword)
        toastSuccess('Kata sandi berhasil diperbarui')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui kata sandi'
        toastError('Gagal memperbarui kata sandi', msg)
        throw err
      }
    },
    [toastSuccess, toastError]
  )

  // ─── School ────────────────────────────────────────────────────────────────

  const updateSchool = useCallback(
    async (data: { name?: string; address?: string; principal_name?: string }) => {
      if (!schoolId) return
      if (storeProfile?.role !== 'Staf_Admin') {
        const msg = 'Hanya Staf Admin yang dapat mengubah informasi sekolah'
        toastError('Akses ditolak', msg)
        throw new Error(msg)
      }
      try {
        const updated = await svcUpdateSchool(schoolId, data)
        setSchool(updated)
        toastSuccess('Data sekolah berhasil diperbarui')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui data sekolah'
        toastError('Gagal memperbarui data sekolah', msg)
        throw err
      }
    },
    [schoolId, storeProfile?.role, toastSuccess, toastError]
  )

  // ─── Academic Years ────────────────────────────────────────────────────────

  const createAcademicYear = useCallback(
    async (name: string) => {
      if (!schoolId) return
      if (storeProfile?.role !== 'Staf_Admin') {
        const msg = 'Hanya Staf Admin yang dapat menambah tahun ajaran'
        toastError('Akses ditolak', msg)
        throw new Error(msg)
      }
      try {
        const created = await svcCreateAcademicYear({ school_id: schoolId, name })
        setAcademicYears((prev) =>
          [created, ...prev].sort((a, b) => b.name.localeCompare(a.name))
        )
        toastSuccess('Tahun ajaran berhasil dibuat')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal membuat tahun ajaran'
        toastError('Gagal membuat tahun ajaran', msg)
        throw err
      }
    },
    [schoolId, storeProfile?.role, toastSuccess, toastError]
  )

  const setActiveAcademicYear = useCallback(
    async (academicYearId: string) => {
      if (!schoolId) return
      if (storeProfile?.role !== 'Staf_Admin') {
        const msg = 'Hanya Staf Admin yang dapat mengaktifkan tahun ajaran'
        toastError('Akses ditolak', msg)
        throw new Error(msg)
      }
      try {
        const { academicYear, semesters } = await svcSetActiveAcademicYear(schoolId, academicYearId)
        setAcademicYears((prev) =>
          prev.map((y) => ({ ...y, is_active: y.id === academicYearId }))
        )
        setStoreActiveAcademicYear(academicYear)
        setStoreActiveSemester(semesters[0] ?? null)
        toastSuccess('Tahun ajaran aktif berhasil diubah (Semester Ganjil & Genap siap)')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengubah tahun ajaran aktif'
        toastError('Gagal mengubah tahun ajaran aktif', msg)
        throw err
      }
    },
    [schoolId, storeProfile?.role, setStoreActiveAcademicYear, setStoreActiveSemester, toastSuccess, toastError]
  )

  // ─── Grade Scales ──────────────────────────────────────────────────────────

  const saveGradeScales = useCallback(
    async (scales: { min_score: number; max_score: number; letter: string }[]) => {
      if (!schoolId) return
      if (storeProfile?.role !== 'Staf_Admin') {
        const msg = 'Hanya Staf Admin yang dapat mengubah skala nilai'
        toastError('Akses ditolak', msg)
        throw new Error(msg)
      }
      try {
        await svcSaveGradeScales(schoolId, scales)
        // Muat ulang agar id dari database ikut terisi
        const fresh = await getGradeScales(schoolId)
        setGradeScales(fresh)
        toastSuccess('Skala nilai berhasil disimpan')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan skala nilai'
        toastError('Gagal menyimpan skala nilai', msg)
        throw err
      }
    },
    [schoolId, storeProfile?.role, toastSuccess, toastError]
  )

  return {
    profile,
    school,
    academicYears,
    gradeScales,
    loading,
    loadError,
    reload,
    updateProfile,
    uploadAvatar,
    updatePassword,
    updateSchool,
    createAcademicYear,
    setActiveAcademicYear,
    saveGradeScales,
  }
}

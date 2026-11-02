import { useCallback, useEffect, useState } from 'react'
import type { Profile, School, AcademicYear, GradeScale } from '@/types/database.types'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast/useToast'
import {
  updateProfile as svcUpdateProfile,
  updatePassword as svcUpdatePassword,
  getSchool,
  updateSchool as svcUpdateSchool,
  getAcademicYears,
  createAcademicYear as svcCreateAcademicYear,
  setActiveAcademicYear as svcSetActiveAcademicYear,
  getGradeScales,
  saveGradeScales as svcSaveGradeScales,
} from '@/services/settingsService'

export function useSettings() {
  const storeProfile = useAuthStore((s) => s.profile)
  const setSession = useAuthStore((s) => s.setSession)
  const session = useAuthStore((s) => s.session)
  const { toastSuccess, toastError } = useToast()

  const schoolId = storeProfile?.school_id ?? null
  const userId = storeProfile?.id ?? null

  const [profile, setProfile] = useState<Profile | null>(storeProfile)
  const [school, setSchool] = useState<School | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([])
  const [loading, setLoading] = useState(false)

  // Sinkronisasi profile dari store saat store berubah
  useEffect(() => {
    setProfile(storeProfile)
  }, [storeProfile])

  // Muat data sekolah, tahun ajaran, dan skala nilai saat mount
  useEffect(() => {
    if (!schoolId) return
    setLoading(true)
    Promise.all([
      getSchool(schoolId),
      getAcademicYears(schoolId),
      getGradeScales(schoolId),
    ])
      .then(([schoolData, years, scales]) => {
        setSchool(schoolData)
        setAcademicYears(years)
        setGradeScales(scales)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Gagal memuat pengaturan'
        toastError('Gagal memuat pengaturan', msg)
      })
      .finally(() => setLoading(false))
  }, [schoolId, toastError])

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
    [schoolId, toastSuccess, toastError]
  )

  // ─── Academic Years ────────────────────────────────────────────────────────

  const createAcademicYear = useCallback(
    async (name: string) => {
      if (!schoolId) return
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
    [schoolId, toastSuccess, toastError]
  )

  const setActiveAcademicYear = useCallback(
    async (academicYearId: string) => {
      if (!schoolId) return
      try {
        await svcSetActiveAcademicYear(schoolId, academicYearId)
        setAcademicYears((prev) =>
          prev.map((y) => ({ ...y, is_active: y.id === academicYearId }))
        )
        toastSuccess('Tahun ajaran aktif berhasil diubah')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengubah tahun ajaran aktif'
        toastError('Gagal mengubah tahun ajaran aktif', msg)
        throw err
      }
    },
    [schoolId, toastSuccess, toastError]
  )

  // ─── Grade Scales ──────────────────────────────────────────────────────────

  const saveGradeScales = useCallback(
    async (scales: { min_score: number; max_score: number; letter: string }[]) => {
      if (!schoolId) return
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
    [schoolId, toastSuccess, toastError]
  )

  return {
    profile,
    school,
    academicYears,
    gradeScales,
    loading,
    updateProfile,
    updatePassword,
    updateSchool,
    createAcademicYear,
    setActiveAcademicYear,
    saveGradeScales,
  }
}

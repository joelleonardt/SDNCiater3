import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AcademicYear, Semester } from '@/types/database.types'

export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  activeAcademicYear: AcademicYear | null
  activeSemester: Semester | null
  theme: Theme
  setActiveAcademicYear: (ay: AcademicYear) => void
  setActiveSemester: (semester: Semester) => void
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeAcademicYear: null,
      activeSemester: null,
      theme: 'system',

      setActiveAcademicYear: (ay) => set({ activeAcademicYear: ay }),

      setActiveSemester: (semester) => set({ activeSemester: semester }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'sekolah-admin-app',
      // Hanya persist theme; activeAcademicYear & activeSemester di-refetch tiap sesi
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)

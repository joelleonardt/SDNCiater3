import { useState, useEffect, useCallback, useRef } from 'react'
import type { Student } from '@/types/database.types'
import {
  getStudents,
  softDeleteStudent,
  type StudentFilters,
} from '@/services/studentService'

interface UseStudentsState {
  data: Student[]
  totalCount: number
  isLoading: boolean
  error: string | null
}

interface UseStudentsReturn extends UseStudentsState {
  filters: StudentFilters
  pageIndex: number
  pageSize: number
  setSearch: (search: string) => void
  setGender: (gender: string) => void
  setPageIndex: (page: number) => void
  setPageSize: (size: number) => void
  deleteStudent: (id: string) => Promise<void>
  refresh: () => void
}

/**
 * Hook untuk mengelola state daftar siswa: pencarian, filter, pagination, dan soft-delete.
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */
export function useStudents(): UseStudentsReturn {
  const [data, setData] = useState<Student[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearchRaw] = useState('')
  const [gender, setGenderRaw] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSizeRaw] = useState(10)

  // debounce search 300ms
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPageIndex(0) // reset ke halaman pertama setiap kali search berubah
    }, 300)
  }, [])

  const setGender = useCallback((value: string) => {
    setGenderRaw(value)
    setPageIndex(0)
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size)
    setPageIndex(0)
  }, [])

  // key untuk memaksa refresh
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const filters: StudentFilters = {}
    if (debouncedSearch) filters.search = debouncedSearch
    if (gender) filters.gender = gender

    getStudents(filters, pageIndex, pageSize)
      .then(({ data: rows, totalCount: total }) => {
        if (!cancelled) {
          setData(rows)
          setTotalCount(total)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? 'Gagal memuat data siswa.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, gender, pageIndex, pageSize, refreshKey])

  const deleteStudent = useCallback(
    async (id: string) => {
      await softDeleteStudent(id)
      refresh()
    },
    [refresh],
  )

  const filters: StudentFilters = {}
  if (search) filters.search = search
  if (gender) filters.gender = gender

  return {
    data,
    totalCount,
    isLoading,
    error,
    filters,
    pageIndex,
    pageSize,
    setSearch,
    setGender,
    setPageIndex,
    setPageSize,
    deleteStudent,
    refresh,
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AttendanceForm from '@/features/attendance/AttendanceForm'
import * as attendanceService from '@/services/attendanceService'
import { useUIStore } from '@/stores/uiStore'
import type { AttendanceRecord } from '@/services/attendanceService'

vi.mock('@/services/attendanceService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/attendanceService')>()
  return {
    ...actual,
    getAttendanceByClassAndDate: vi.fn(),
    saveAttendance: vi.fn(),
  }
})

function makeRecords(): AttendanceRecord[] {
  return [
    {
      id: 'att-1',
      class_id: 'class-1',
      student_id: 'stu-1',
      student_nis: '202501001',
      student_name: 'Anisa Putri Rahayu',
      date: '2026-11-15',
      status: 'Izin',
    },
    {
      id: 'att-2',
      class_id: 'class-1',
      student_id: 'stu-2',
      student_nis: '202501002',
      student_name: 'Budi Santoso',
      date: '2026-11-15',
      status: 'Hadir',
    },
    {
      id: 'att-3',
      class_id: 'class-1',
      student_id: 'stu-3',
      student_nis: '202501003',
      student_name: 'Citra Dewi Lestari',
      date: '2026-11-15',
      status: 'Alfa',
    },
    {
      id: 'att-4',
      class_id: 'class-1',
      student_id: 'stu-4',
      student_nis: '202501004',
      student_name: 'Deni Firmansyah',
      date: '2026-11-15',
      status: 'Sakit',
    },
  ]
}

describe('AttendanceForm Tandai Semua Hadir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState({ toasts: [] })
  })

  it('immediately switches all students to Hadir on a single click and persists in one batch call', async () => {
    const initial = makeRecords()
    vi.mocked(attendanceService.getAttendanceByClassAndDate).mockResolvedValue(initial)

    let resolveSave!: () => void
    vi.mocked(attendanceService.saveAttendance).mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve })
    )

    render(<AttendanceForm classId="class-1" date="2026-11-15" />)

    await screen.findByText('Anisa Putri Rahayu')

    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua siswa hadir' }))

    for (const student of initial) {
      const group = screen.getByRole('group', {
        name: `Status kehadiran siswa ${student.student_name}`,
      })
      expect(within(group).getByRole('button', { name: 'Hadir' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(within(group).getByRole('button', { name: 'Sakit' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      expect(within(group).getByRole('button', { name: 'Izin' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      expect(within(group).getByRole('button', { name: 'Alfa' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }

    expect(attendanceService.saveAttendance).toHaveBeenCalledTimes(1)
    expect(attendanceService.saveAttendance).toHaveBeenCalledWith(
      initial.map((r) => ({
        class_id: 'class-1',
        student_id: r.student_id,
        date: '2026-11-15',
        status: 'Hadir',
      }))
    )

    resolveSave()

    await waitFor(() => {
      expect(useUIStore.getState().toasts[0]?.title).toBe('Semua siswa ditandai Hadir')
    })
  })

  it('rolls back all student statuses if batch save fails', async () => {
    const initial = makeRecords()
    vi.mocked(attendanceService.getAttendanceByClassAndDate).mockResolvedValue(initial)
    vi.mocked(attendanceService.saveAttendance).mockRejectedValue(new Error('network down'))

    render(<AttendanceForm classId="class-1" date="2026-11-15" />)

    await screen.findByText('Anisa Putri Rahayu')
    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua siswa hadir' }))

    await waitFor(() => {
      expect(useUIStore.getState().toasts[0]?.title).toBe('Gagal memperbarui status kehadiran')
    })

    for (const student of initial) {
      const group = screen.getByRole('group', {
        name: `Status kehadiran siswa ${student.student_name}`,
      })
      expect(within(group).getByRole('button', { name: student.status })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    }
  })

  it('preserves concurrent single-student status updates without overwriting earlier clicks', async () => {
    const initial = makeRecords()
    vi.mocked(attendanceService.getAttendanceByClassAndDate).mockResolvedValue(initial)

    let resolveFirst!: () => void
    let resolveSecond!: () => void
    vi.mocked(attendanceService.saveAttendance)
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveSecond = r }))

    render(<AttendanceForm classId="class-1" date="2026-11-15" />)
    await screen.findByText('Anisa Putri Rahayu')

    const anisaGroup = screen.getByRole('group', {
      name: 'Status kehadiran siswa Anisa Putri Rahayu',
    })
    const citraGroup = screen.getByRole('group', {
      name: 'Status kehadiran siswa Citra Dewi Lestari',
    })

    fireEvent.click(within(anisaGroup).getByRole('button', { name: 'Hadir' }))
    fireEvent.click(within(citraGroup).getByRole('button', { name: 'Hadir' }))

    expect(within(anisaGroup).getByRole('button', { name: 'Hadir' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(citraGroup).getByRole('button', { name: 'Hadir' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    resolveFirst()
    resolveSecond()
  })
})

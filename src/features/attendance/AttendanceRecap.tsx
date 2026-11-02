import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { getAttendanceRecap, type AttendanceRecap as AttendanceRecapRow } from '@/services/attendanceService'
import DataTable, { type ColumnDef } from '@/components/ui/DataTable'
import SkeletonTable from '@/components/ui/SkeletonTable'
import EmptyState from '@/components/ui/EmptyState'

interface AttendanceRecapProps {
  classId: string
  className?: string
  startDate: string
  endDate: string
}

const COLUMNS: ColumnDef<AttendanceRecapRow>[] = [
  { key: 'full_name', header: 'Nama Siswa', cell: (r) => r.full_name },
  {
    key: 'hadir',
    header: 'Hadir',
    className: 'text-right w-20',
    cell: (r) => <span className="text-green-700 font-medium">{r.hadir}</span>,
  },
  {
    key: 'sakit',
    header: 'Sakit',
    className: 'text-right w-20',
    cell: (r) => <span className="text-yellow-700">{r.sakit}</span>,
  },
  {
    key: 'izin',
    header: 'Izin',
    className: 'text-right w-20',
    cell: (r) => <span className="text-blue-700">{r.izin}</span>,
  },
  {
    key: 'alpa',
    header: 'Alpa',
    className: 'text-right w-20',
    cell: (r) => <span className="text-red-700">{r.alpa}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    className: 'text-right w-20',
    cell: (r) => r.total,
  },
  {
    key: 'persentase_hadir',
    header: '% Hadir',
    className: 'text-right w-24',
    cell: (r) => `${r.persentase_hadir}%`,
  },
]

/**
 * Rekap kehadiran siswa per rentang tanggal.
 * total dan persentase_hadir dihitung di attendanceService.
 * Requirements: 9.3
 */
export default function AttendanceRecap({ classId, startDate, endDate }: AttendanceRecapProps) {
  const [data, setData] = useState<AttendanceRecapRow[]>([])
  const [loading, setLoading] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    if (!classId || !startDate || !endDate) return
    setLoading(true)
    setPageIndex(0)
    getAttendanceRecap(classId, startDate, endDate)
      .then((rows) =>
        setData(rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'id')))
      )
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [classId, startDate, endDate])

  if (loading) return <SkeletonTable columns={7} rows={5} delay={300} />

  if (data.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Belum ada data kehadiran"
        description="Tidak ada rekaman kehadiran untuk kelas dan rentang tanggal yang dipilih."
      />
    )
  }

  const paged = data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  return (
    <DataTable
      columns={COLUMNS as unknown as ColumnDef<Record<string, unknown>>[]}
      data={paged as unknown as Record<string, unknown>[]}
      totalCount={data.length}
      pageSize={pageSize}
      pageIndex={pageIndex}
      onPageChange={setPageIndex}
      onPageSizeChange={(s) => { setPageSize(s); setPageIndex(0) }}
      isLoading={false}
      emptyMessage="Tidak ada data kehadiran untuk rentang tanggal ini."
    />
  )
}

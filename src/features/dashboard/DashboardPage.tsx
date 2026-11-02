import PageHeader from '@/components/ui/PageHeader'
import AnnouncementsPanel from './AnnouncementsPanel'
import SummaryCards from './SummaryCards'
import TodaySchedule from './TodaySchedule'
import WeeklyAttendanceChart from './WeeklyAttendanceChart'
import { useDashboard } from './useDashboard'

export default function DashboardPage() {
  const { pageTitle } = useDashboard()

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={pageTitle} />

      {/* Baris 1: Kartu ringkasan (full width) */}
      <SummaryCards />

      {/* Baris 2: Grafik absensi (2/3) | Jadwal hari ini (1/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyAttendanceChart />
        </div>
        <div className="lg:col-span-1">
          <TodaySchedule />
        </div>
      </div>

      {/* Baris 3: Panel pengumuman (full width) */}
      <AnnouncementsPanel />
    </div>
  )
}

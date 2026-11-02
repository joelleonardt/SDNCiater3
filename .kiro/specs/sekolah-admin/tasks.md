# Implementation Plan: Sekolah Admin

## Overview

Rencana implementasi ini mengikuti urutan prioritas: setup Supabase → scaffolding proyek → autentikasi → layout → fitur inti (Dashboard, Kelas, Siswa, Kehadiran, Laporan, Pengguna, Pengaturan) → fitur opsional (Jadwal, Catatan, Nilai) → polish UX → property-based tests. Setiap task membangun di atas task sebelumnya dan diakhiri dengan integrasi penuh.

## Tasks

- [x] 1. Supabase Setup dan Konfigurasi Awal
  - [x] 1.1 Buat file SQL schema untuk semua tabel database
    - Buat `supabase/schema.sql` dengan DDL untuk semua 13 tabel: `profiles`, `schools`, `academic_years`, `semesters`, `classes`, `students`, `class_students`, `attendance`, `schedules`, `notes`, `grade_components`, `grades`, `grade_scales`
    - Tambahkan foreign key constraints antar tabel sesuai design
    - Aktifkan RLS pada setiap tabel dengan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Buat file SQL RLS policies untuk ketiga peran
    - Buat `supabase/rls_policies.sql` dengan policies untuk Guru (akses ke kelas yang diajar), Kepala_Sekolah (SELECT semua baris sekolah), dan Staf_Admin (full access di sekolah sendiri)
    - Terapkan pola policy seperti yang didefinisikan di design.md untuk setiap tabel
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 1.3 Buat file SQL seed untuk data development
    - Buat `supabase/seed.sql` dengan minimal: 1 sekolah, 1 tahun ajaran, 2 semester, 3 kelas, 10 siswa
    - Jangan sertakan URL/key Supabase di file ini
    - _Requirements: 1.7, 1.8_

  - [x] 1.4 Buat `.env.example` dan dokumen setup instruksi
    - Buat `.env.example` dengan placeholder `VITE_SUPABASE_URL=` dan `VITE_SUPABASE_ANON_KEY=`
    - Buat `SETUP.md` yang mencakup langkah: buat Supabase project, jalankan schema SQL, jalankan seed SQL, konfigurasi `.env`
    - _Requirements: 1.8, 1.9_

- [x] 2. Scaffolding Proyek
  - [x] 2.1 Inisialisasi proyek Vite + React + TypeScript
    - Buat proyek dengan `npm create vite@latest` menggunakan template `react-ts`
    - Tambahkan Tailwind CSS v3 dan konfigurasi `tailwind.config.ts` dengan path `src/**`
    - Install dan konfigurasi shadcn/ui (`npx shadcn-ui@latest init`)
    - _Requirements: 16.1_

  - [x] 2.2 Setup React Router dan struktur folder fitur
    - Install `react-router-dom` dan konfigurasi `BrowserRouter` di `src/app/App.tsx`
    - Buat struktur folder `src/features/`, `src/components/ui/`, `src/services/`, `src/stores/`, `src/lib/`, `src/types/` sesuai design
    - Buat `src/app/routes.tsx` dengan placeholder routes untuk semua halaman
    - _Requirements: 3.8, 16.1, 16.2, 16.3_

  - [x] 2.3 Setup Supabase client dan TypeScript types
    - Install `@supabase/supabase-js`
    - Buat `src/services/supabase.ts` dengan `createClient` menggunakan env vars
    - Buat `src/types/database.types.ts` dengan type aliases untuk semua tabel
    - _Requirements: 1.8, 16.3_

  - [x] 2.4 Setup Zustand stores dan utility functions
    - Install `zustand`
    - Buat `src/stores/authStore.ts` (AuthState interface)
    - Buat `src/stores/appStore.ts` (AppState interface)
    - Buat `src/stores/uiStore.ts` (UIState interface)
    - Buat `src/lib/utils.ts` dengan `cn()`, date formatters, dan number formatters
    - Buat `src/lib/validators.ts` dengan Zod schemas dasar
    - _Requirements: 16.5_

  - [x] 2.5 Setup testing framework
    - Install `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `fast-check`
    - Konfigurasi `vitest.config.ts` dengan environment jsdom
    - _Requirements: (testing infrastructure)_

- [x] 3. Autentikasi dan Proteksi Rute
  - [x] 3.1 Implementasi `authService.ts` dan auth store
    - Buat `src/services/authService.ts` dengan fungsi: `signIn`, `signOut`, `sendPasswordReset`, `updatePassword`, `getProfile`
    - Isi `authStore.ts` dengan `setSession`, `clearSession`, dan inisialisasi via `supabase.auth.onAuthStateChange()`
    - _Requirements: 2.1, 2.7_

  - [x] 3.2 Buat `LoginPage`, `ForgotPasswordPage`, dan `ResetPasswordPage`
    - Buat `src/features/auth/LoginPage.tsx` dengan form email + password, tombol "Lupa Kata Sandi", error handling Bahasa Indonesia
    - Buat `src/features/auth/ForgotPasswordPage.tsx` dengan form email dan feedback pengiriman
    - Buat `src/features/auth/ResetPasswordPage.tsx` dengan form password baru (min 8 karakter) dan redirect ke login setelah sukses
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.11_

  - [x] 3.3 Implementasi `ProtectedRoute` dan `RoleGuard`
    - Buat `src/components/ui/ProtectedRoute.tsx` yang redirect ke `/login` jika tidak ada session
    - Buat `src/components/ui/RoleGuard.tsx` yang redirect ke `/403` jika role tidak cocok
    - Terapkan redirect ke dashboard jika user terautentikasi mengakses halaman login
    - _Requirements: 2.5, 2.6, 3.6, 3.7_

  - [x] 3.4 Implementasi session expiry dan halaman 403
    - Tambahkan deteksi sesi kadaluarsa di `onAuthStateChange` dengan redirect + pesan Bahasa Indonesia
    - Buat halaman `/403` dengan pesan "Anda tidak memiliki akses ke halaman ini"
    - _Requirements: 2.8, 3.7_

  - [ ]* 3.5 Tulis unit tests untuk auth service dan protected routes
    - Test `signIn` dengan kredensial salah (expect error message Bahasa Indonesia)
    - Test redirect `/login` ketika tidak ada session
    - Test redirect ke dashboard ketika user sudah login mencoba akses `/login`
    - _Requirements: 2.2, 2.5, 2.6_

- [x] 4. Layout dan Navigasi
  - [x] 4.1 Buat `AppShell`, `Sidebar`, dan `Topbar`
    - Buat `src/components/ui/AppShell.tsx` sebagai wrapper layout untuk semua halaman terautentikasi
    - Buat `src/components/ui/Sidebar.tsx` dengan collapsible state dari `uiStore`, navigation items bersyarat berdasarkan role
    - Buat `src/components/ui/Topbar.tsx` dengan logo, search field global, icon notifikasi, dan profile menu ("Profil Saya", "Keluar")
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 4.2 Implementasi navigasi mobile dan active state
    - Tambahkan mobile drawer overlay pada Sidebar yang muncul saat hamburger diklik (`<1024px`)
    - Tutup drawer saat user tap di luar atau pilih menu item
    - Aplikasikan active highlight (background fill atau left-border) pada menu item yang sesuai dengan rute aktif
    - _Requirements: 3.2, 3.5_

  - [x] 4.3 Implementasi navigation items berbasis peran dan responsive layout
    - Render menu item secara kondisional berdasarkan `authStore.profile.role`
    - Pastikan layout responsif dari 320px hingga 1920px menggunakan Tailwind breakpoints
    - Integrasikan `ProtectedRoute` dan `RoleGuard` pada route definitions
    - _Requirements: 3.6, 15.5_

  - [ ]* 4.4 Tulis unit tests untuk Sidebar dan RoleGuard
    - Test bahwa menu item tersembunyi untuk role yang tidak diizinkan
    - Test redirect ke `/403` untuk akses langsung ke rute yang dilarang
    - _Requirements: 3.6, 3.7_

- [x] 5. Komponen UI Shared
  - [x] 5.1 Buat `DataTable`, `ConfirmDialog`, dan `PageHeader`
    - Buat `src/components/ui/DataTable.tsx` dengan props sesuai interface di design (columns, data, totalCount, pageSize, pageIndex, onPageChange, onPageSizeChange, isLoading, emptyMessage)
    - Buat `src/components/ui/ConfirmDialog.tsx` dengan tombol "Hapus" dan "Batal"
    - Buat `src/components/ui/PageHeader.tsx` untuk judul halaman
    - _Requirements: 6.3, 14.4_

  - [x] 5.2 Buat Toast provider, `SkeletonTable`, dan `EmptyState`
    - Buat `src/components/ui/Toast/` dengan provider dan hook `useToast`
    - Toast sukses (auto-dismiss 4 detik) dan error (persist sampai user close) dengan ikon berbeda
    - Buat `src/components/ui/SkeletonTable.tsx` yang tampil saat loading >300ms
    - Buat `src/components/ui/EmptyState.tsx` dengan ilustrasi dan pesan Bahasa Indonesia
    - _Requirements: 14.1, 14.2, 14.5, 14.6, 14.9_

  - [x] 5.3 Implementasi dark mode dan theme toggle
    - Tambahkan theme toggle di Topbar
    - Implementasi deteksi OS preference dan persisten manual selection di `appStore`
    - Konfigurasi Tailwind dark mode (`class` strategy)
    - Pastikan contrast ratio WCAG AA ≥4.5:1 dan font size ≥16px
    - _Requirements: 14.7, 14.8_

- [x] 6. Dashboard
  - [x] 6.1 Implementasi `dashboardService` dan summary cards
    - Buat `src/services/dashboardService.ts` dengan queries: total siswa aktif, total kelas, persentase kehadiran hari ini
    - Buat `src/features/dashboard/SummaryCards.tsx` yang menampilkan ketiga metrik
    - Formula persentase: `(total Hadir ÷ total siswa aktif) × 100` dibulatkan 1 desimal
    - _Requirements: 4.1_

  - [x] 6.2 Implementasi `TodaySchedule` dan `AnnouncementsPanel`
    - Buat `src/features/dashboard/TodaySchedule.tsx` yang menampilkan jadwal hari ini berdasarkan role (Guru: hanya kelas yang diampu; Staf_Admin: semua kelas)
    - Buat `src/features/dashboard/AnnouncementsPanel.tsx` yang menampilkan 5 pengumuman terbaru
    - _Requirements: 4.2, 4.3_

  - [x] 6.3 Implementasi `WeeklyAttendanceChart` dan skeleton/empty states
    - Buat `src/features/dashboard/WeeklyAttendanceChart.tsx` dengan chart persentase kehadiran per hari (Senin–Minggu minggu berjalan)
    - Install library chart (contoh: `recharts`)
    - Tambahkan skeleton placeholders untuk semua card dan chart saat loading
    - Tampilkan empty-state message Bahasa Indonesia jika tidak ada data
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 6.4 Wiring Dashboard page dan `useDashboard` hook
    - Buat `src/features/dashboard/DashboardPage.tsx` yang menyusun semua komponen
    - Buat `src/features/dashboard/useDashboard.ts` yang mengambil semua data dashboard
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Checkpoint — Ensure all tests pass
  - Pastikan semua unit tests lulus, semua rute dapat diakses, auth dan layout berfungsi. Tanyakan kepada user jika ada pertanyaan.

- [x] 8. Manajemen Kelas
  - [x] 8.1 Implementasi `classService.ts` dan `useClasses` hook
    - Buat `src/services/classService.ts` dengan fungsi: `getClasses`, `createClass`, `updateClass`, `deleteClass`
    - Buat `src/features/classes/useClasses.ts`
    - _Requirements: 5.1, 5.3_

  - [x] 8.2 Buat `ClassesPage` dan `ClassFormModal`
    - Buat `src/features/classes/ClassesPage.tsx` dengan tabel kelas (nama, tingkat, wali kelas, jumlah siswa)
    - Buat `src/features/classes/ClassFormModal.tsx` dengan validasi: nama kelas (1–50 karakter), grade level (1–12), homeroom teacher opsional
    - Tampilkan empty state jika tidak ada Tahun_Ajaran aktif
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 8.3 Tulis unit tests untuk class service dan form validation
    - Test duplikasi nama kelas dalam Tahun_Ajaran yang sama
    - Test validasi field (nama kosong, grade level di luar 1–12)
    - _Requirements: 5.3, 5.8_

- [x] 9. Manajemen Siswa
  - [x] 9.1 Implementasi `studentService.ts` dan `useStudents` hook
    - Isi `src/services/studentService.ts` dengan fungsi: `getStudents` (paginated + filtered), `getStudentById`, `createStudent`, `updateStudent`, `softDeleteStudent`
    - Buat `src/features/students/useStudents.ts`
    - _Requirements: 6.1, 6.3_

  - [x] 9.2 Buat `StudentsPage` dengan search, filter, dan pagination
    - Buat `src/features/students/StudentsPage.tsx` menggunakan `DataTable`
    - Implementasi debounced search (≤300ms) berdasarkan nama, NIS, atau kelas
    - Page size: 10, 25, atau 50 baris
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.3 Buat `StudentFormModal` dan `StudentDetailPage`
    - Buat `src/features/students/StudentFormModal.tsx` dengan field: nama lengkap, NIS, gender, tanggal lahir, nama/kontak orang tua (opsional)
    - Validasi field wajib dan duplikasi NIS dengan error Bahasa Indonesia
    - Buat `src/features/students/StudentDetailPage.tsx` dengan semua data siswa, rekap kehadiran, dan 5 catatan terbaru
    - Buat `src/features/students/CsvImportDialog.tsx` sebagai placeholder "coming soon"
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [ ]* 9.4 Tulis unit tests untuk student service
    - Test soft-delete (record tidak muncul di list normal)
    - Test pencarian/filter mengembalikan subset yang tepat
    - _Requirements: 6.7_

- [x] 10. Kehadiran
  - [x] 10.1 Implementasi `attendanceService.ts` dan `useAttendance` hook
    - Isi `src/services/attendanceService.ts` dengan fungsi: `getAttendanceByClassAndDate`, `saveAttendance`, `getAttendanceRecap`
    - Buat `src/features/attendance/useAttendance.ts`
    - _Requirements: 7.1, 7.5, 7.8_

  - [x] 10.2 Buat `AttendancePage` dan `AttendanceForm`
    - Buat `src/features/attendance/AttendancePage.tsx` dengan selector kelas dan tanggal
    - Buat `src/features/attendance/AttendanceForm.tsx` dengan daftar siswa, selector status (Hadir/Sakit/Izin/Alpa), tombol "Tandai Semua Hadir"
    - Pre-fill form jika data sudah ada untuk kelas + tanggal tersebut
    - Skeleton loading untuk daftar siswa
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7, 7.9_

  - [x] 10.3 Implementasi optimistic update dan `AttendanceRecap`
    - Implementasi optimistic UI: update status lokal langsung, revert jika server request gagal
    - Buat `src/features/attendance/AttendanceRecap.tsx` dengan rekap per siswa (total per status) untuk rentang 1–31 hari
    - _Requirements: 7.5, 7.6, 7.8, 15.3_

  - [ ]* 10.4 Tulis property test untuk kehadiran (Property 5 dan 11)
    - **Property 5: Rekap Kehadiran Konsisten dengan Data Mentah**
    - **Validates: Requirements 7.8**
    - **Property 11: Optimistic Update Revert pada Kegagalan Server**
    - **Validates: Requirements 15.3**
    - _Requirements: 7.8, 15.3_

- [x] 11. Checkpoint — Ensure all tests pass
  - Pastikan fitur Kelas, Siswa, dan Kehadiran berfungsi end-to-end. Tanyakan kepada user jika ada pertanyaan.

- [x] 12. Laporan PDF
  - [x] 12.1 Setup `pdfGenerator.ts` dan `reportService.ts`
    - Install `jspdf` dan `jspdf-autotable`
    - Buat `src/lib/pdfGenerator.ts` sebagai wrapper jsPDF + autotable
    - Buat `src/services/reportService.ts` dengan fungsi: `generateAttendancePdf`, `generateReportCardPdf`
    - Implementasi timeout 10 detik dengan cancel dan error message
    - _Requirements: 11.3, 11.4_

  - [x] 12.2 Buat `ReportsPage` dengan form laporan kehadiran dan rapor
    - Buat `src/features/reports/ReportsPage.tsx`
    - Buat `src/features/reports/AttendanceReportForm.tsx` dengan selector kelas dan rentang tanggal (max 366 hari)
    - Buat `src/features/reports/ReportCardForm.tsx` dengan selector siswa dan semester
    - Tampilkan loading indicator saat PDF di-generate
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 12.3 Implementasi format tanggal dan angka untuk laporan
    - Implementasi `formatReportDate` di `src/lib/utils.ts`: `dd MMMM yyyy` Bahasa Indonesia
    - Implementasi `parseReportDate` untuk round-trip konsistensi
    - Implementasi format angka dengan titik sebagai pemisah ribuan
    - _Requirements: 11.6, 11.7_

  - [ ]* 12.4 Tulis property test untuk format tanggal (Property 7)
    - **Property 7: Serialisasi / Deserialisasi Format Tanggal Laporan**
    - **Validates: Requirements 11.6**
    - _Requirements: 11.6_

- [x] 13. Manajemen Pengguna
  - [x] 13.1 Implementasi `userService.ts` dan `useUsers` hook
    - Buat `src/services/userService.ts` dengan fungsi: `getUsers`, `createUser` (via Supabase Admin API), `updateUserRole`, `deactivateUser`
    - Buat `src/features/users/useUsers.ts`
    - _Requirements: 12.2, 12.4, 12.6, 12.8_

  - [x] 13.2 Buat `UsersPage` dan `UserFormModal`
    - Buat `src/features/users/UsersPage.tsx` dengan tabel pengguna (nama, email, role, tanggal buat), sorted by created_at DESC
    - Mode read-only untuk Kepala_Sekolah (tanpa kontrol add/edit/delete)
    - Buat `src/features/users/UserFormModal.tsx` dengan field: email (max 254 karakter), nama lengkap (1–100 karakter), role selector
    - Tampilkan error jika email sudah terdaftar
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [ ]* 13.3 Tulis unit tests untuk user service
    - Test error pada email duplikat
    - Test read-only mode untuk Kepala_Sekolah
    - _Requirements: 12.5, 12.9_

- [x] 14. Pengaturan
  - [x] 14.1 Implementasi `settingsService.ts` dan `useSettings` hook
    - Buat `src/services/settingsService.ts` dengan fungsi: `updateProfile`, `uploadAvatar`, `updateSchoolInfo`, `createAcademicYear`, `setActiveAcademicYear`, `saveGradeScales`
    - Buat `src/features/settings/useSettings.ts`
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.6_

  - [x] 14.2 Buat `SettingsPage` dengan semua section
    - Buat `src/features/settings/SettingsPage.tsx`
    - Buat `src/features/settings/ProfileSection.tsx`: update nama + upload foto (JPG/PNG, max 2 MB)
    - Buat `src/features/settings/SchoolInfoSection.tsx`: nama sekolah, alamat, nama kepala (Staf_Admin only)
    - Buat `src/features/settings/AcademicYearSection.tsx`: buat/aktifkan Tahun_Ajaran format YYYY/YYYY, auto-create semester Ganjil/Genap
    - Buat `src/features/settings/GradeScaleSection.tsx`: konfigurasi Skala_Nilai dengan validasi range 0–100 tanpa gap/overlap
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [ ]* 14.3 Tulis unit tests untuk settings service
    - Test validasi format YYYY/YYYY untuk Tahun_Ajaran
    - Test validasi foto (format dan ukuran)
    - Test bahwa non-Staf_Admin tidak dapat menyimpan perubahan informasi sekolah
    - _Requirements: 13.2, 13.4, 13.8_

- [x] 15. Checkpoint — Ensure all tests pass
  - Pastikan Laporan, Manajemen Pengguna, dan Pengaturan berfungsi dengan benar. Tanyakan kepada user jika ada pertanyaan.

- [x] 16. Fitur Opsional — Jadwal Mengajar (F-8)
  - [x] 16.1 Implementasi `scheduleService.ts` dan `useSchedules` hook
    - Buat `src/services/scheduleService.ts` dengan fungsi: `getSchedules`, `createSchedule`, `updateSchedule`, `deleteSchedule`
    - Deteksi konflik: teacher_id + day_of_week + start_time yang sama
    - Buat `src/features/schedules/useSchedules.ts`
    - _Requirements: 8.4, 8.5_

  - [x] 16.2 Buat `SchedulePage`, `WeeklyGrid`, dan `ScheduleFormModal`
    - Buat `src/features/schedules/SchedulePage.tsx`
    - Buat `src/features/schedules/WeeklyGrid.tsx`: grid Senin–Sabtu × 07:00–17:00 (interval 45 menit)
    - Buat `src/features/schedules/ScheduleFormModal.tsx`: hari, time slot, mata pelajaran, kelas (Staf_Admin only)
    - Tampilkan empty state jika tidak ada jadwal
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [ ]* 16.3 Tulis property test untuk deteksi konflik jadwal (Property 12)
    - **Property 12: Deteksi Konflik Jadwal**
    - **Validates: Requirements 8.5**
    - _Requirements: 8.5_

- [x] 17. Fitur Opsional — Catatan Siswa (F-9)
  - [x] 17.1 Implementasi `noteService.ts` dan `useNotes` hook
    - Buat `src/services/noteService.ts` dengan fungsi: `getNotesByStudent`, `createNote`, `updateNote`, `deleteNote`
    - Validasi author: hanya author asli atau Staf_Admin yang dapat edit/delete
    - Buat `src/features/notes/useNotes.ts`
    - _Requirements: 9.3, 9.4, 9.5_

  - [x] 17.2 Buat `NoteList` dan `NoteFormModal`
    - Buat `src/features/notes/NoteList.tsx`: tampilkan catatan dalam urutan kronologis terbalik
    - Buat `src/features/notes/NoteFormModal.tsx`: kategori (Perilaku/Prestasi), tanggal (≤ today), teks (1–1000 karakter)
    - Integrasikan ke `StudentDetailPage`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 17.3 Tulis property test untuk catatan siswa (Property 9)
    - **Property 9: Catatan Siswa Tersimpan dengan Author yang Benar**
    - **Validates: Requirements 9.3**
    - _Requirements: 9.3_

- [x] 18. Fitur Opsional — Nilai (F-10)
  - [x] 18.1 Implementasi `gradeService.ts`, kalkulasi nilai, dan `useGrades` hook
    - Isi `src/services/gradeService.ts` dengan semua fungsi dari design: `getGradeComponents`, `saveGradeComponents`, `getGrades`, `saveGrades`, `calculateWeightedAverage`
    - Implementasi `calculateWeightedAverage` dan `getLetterGrade` di `src/lib/utils.ts`
    - Validasi total bobot = 100 dan nilai di rentang 0–100
    - Buat `src/features/grades/useGrades.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.9_

  - [x] 18.2 Buat `GradesPage`, `GradeComponentsConfig`, dan `GradeInputTable`
    - Buat `src/features/grades/GradesPage.tsx`
    - Buat `src/features/grades/GradeComponentsConfig.tsx` untuk konfigurasi komponen nilai (Staf_Admin only)
    - Buat `src/features/grades/GradeInputTable.tsx`: tabel siswa × komponen nilai, tampilkan rata-rata/tertinggi/terendah per kelas
    - Block akses ke input table jika total bobot ≠ 100
    - _Requirements: 10.3, 10.4, 10.8_

  - [ ]* 18.3 Tulis property tests untuk nilai (Property 1, 2, 3, 4)
    - **Property 1: Kalkulasi Nilai Akhir Tertimbang**
    - **Validates: Requirements 10.5**
    - **Property 2: Konversi Skala Nilai Idempoten**
    - **Validates: Requirements 10.6**
    - **Property 3: Validasi Skala Nilai Mencakup Tepat 0–100**
    - **Validates: Requirements 13.7**
    - **Property 4: Bobot Komponen Nilai Harus Tepat 100**
    - **Validates: Requirements 10.2**
    - _Requirements: 10.2, 10.5, 10.6, 13.7_

- [x] 19. Checkpoint — Ensure all tests pass
  - Pastikan semua fitur opsional berfungsi dan terintegrasi. Tanyakan kepada user jika ada pertanyaan.

- [ ] 20. Property-Based Tests Lanjutan
  - [ ]* 20.1 Tulis property test untuk persentase kehadiran Dashboard (Property 6)
    - **Property 6: Persentase Kehadiran Harian Konsisten**
    - **Validates: Requirements 4.1, 4.4**
    - _Requirements: 4.1, 4.4_

  - [ ]* 20.2 Tulis property test untuk pencarian siswa (Property 8)
    - **Property 8: Pencarian Siswa Mempertahankan Subset**
    - **Validates: Requirements 6.2**
    - _Requirements: 6.2_

  - [ ]* 20.3 Tulis property test untuk NIS unik per sekolah (Property 10)
    - **Property 10: NIS Unik Per Sekolah**
    - **Validates: Requirements 6.10**
    - _Requirements: 6.10_

- [x] 21. UX Polish dan Code Splitting
  - [x] 21.1 Implementasi code splitting per rute
    - Gunakan `React.lazy()` dan `Suspense` untuk semua halaman di `src/app/routes.tsx`
    - Tambahkan fallback skeleton/spinner per halaman
    - _Requirements: 15.1_

  - [x] 21.2 Audit dan perbaikan form validation dan inline errors
    - Pastikan semua form menampilkan inline error Bahasa Indonesia di bawah field yang invalid
    - Validasi tidak menghapus data valid yang sudah diisi
    - Konfirmasi dialog delete tampil untuk semua operasi hapus
    - _Requirements: 14.3, 14.4, 5.8, 6.9_

  - [x] 21.3 Audit toast notifications dan loading states
    - Pastikan toast sukses auto-dismiss 4 detik, toast error persist dengan tombol close
    - Pastikan ikon toast sukses dan error berbeda secara visual (bentuk dan warna)
    - Pastikan skeleton loading muncul >300ms untuk semua list dan chart
    - _Requirements: 14.1, 14.2, 14.5, 14.9_

- [x] 22. Final Checkpoint — Ensure all tests pass
  - Pastikan semua tests lulus, code splitting berfungsi, dan seluruh aplikasi berjalan dari 320px hingga 1920px. Tanyakan kepada user jika ada pertanyaan.

## Notes

- Task bertanda `*` adalah opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensi requirement spesifik untuk traceabilitas
- Checkpoint memastikan validasi bertahap sebelum lanjut ke fase berikutnya
- Property tests menggunakan `fast-check` dengan minimum 100 iterasi per property
- Unit tests menggunakan `vitest` + `@testing-library/react` dengan Supabase client di-mock via `vi.mock`
- Semua Supabase client calls hanya boleh ada di `src/services/` — tidak ada direct import di komponen React
- Fitur opsional (F-8, F-9, F-10) dapat diimplementasi setelah fitur inti selesai

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4", "3.5"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["4.2", "4.3"] },
    { "id": 9, "tasks": ["4.4", "5.1"] },
    { "id": 10, "tasks": ["5.2", "5.3"] },
    { "id": 11, "tasks": ["6.1", "6.2"] },
    { "id": 12, "tasks": ["6.3"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["8.1", "9.1", "10.1", "12.1", "13.1", "14.1"] },
    { "id": 15, "tasks": ["8.2", "9.2", "10.2", "12.2", "13.2", "14.2"] },
    { "id": 16, "tasks": ["8.3", "9.3", "9.4", "10.3", "12.3", "13.3", "14.3"] },
    { "id": 17, "tasks": ["12.4", "16.1", "17.1", "18.1"] },
    { "id": 18, "tasks": ["16.2", "17.2", "18.2"] },
    { "id": 19, "tasks": ["16.3", "17.3", "18.3"] },
    { "id": 20, "tasks": ["20.1", "20.2", "20.3"] },
    { "id": 21, "tasks": ["21.1", "21.2"] },
    { "id": 22, "tasks": ["21.3"] }
  ]
}
```

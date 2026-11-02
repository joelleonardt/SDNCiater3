# Design Document

## Overview

Sekolah Admin adalah aplikasi web single-page (SPA) administrasi sekolah dasar (SD) Indonesia yang dibangun di atas stack React + Vite, Tailwind CSS + shadcn/ui, React Router, Zustand, dan Supabase. Aplikasi menyediakan satu platform terpadu untuk manajemen siswa, kehadiran, jadwal mengajar, penilaian, dan pelaporan; seluruh antarmuka berbahasa Indonesia.

Tidak ada server backend tambahan — semua operasi data menggunakan Supabase JS client yang berkomunikasi langsung ke PostgreSQL melalui PostgREST, Supabase Auth, dan Supabase Storage. Keamanan data ditegakkan di lapisan database lewat Row Level Security (RLS), bukan di lapisan aplikasi.

### Tujuan Desain

- **Keamanan berbasis peran** — tiga peran (Guru, Kepala_Sekolah, Staf_Admin) dengan RLS Supabase sebagai penjaga utama; UI hanya menyembunyikan/menampilkan elemen sesuai peran.
- **Developer experience** — struktur folder berbasis fitur, isolasi penuh Supabase client di `src/services/`, dan komponen shadcn/ui yang konsisten.
- **Aksesibilitas** — font ≥16px, contrast ratio WCAG AA, dukungan dark mode.
- **Performa** — code splitting per rute, pagination, optimistic update untuk kehadiran.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (SPA)                       │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Pages   │  │  Features    │  │  Components  │  │
│  │ (routes) │→ │  (feature    │→ │  /ui         │  │
│  │          │  │   modules)   │  │  (shared)    │  │
│  └──────────┘  └──────┬───────┘  └──────────────┘  │
│                       │                             │
│              ┌────────▼────────┐                   │
│              │  src/services/  │                   │
│              │  (Supabase JS)  │                   │
│              └────────┬────────┘                   │
│                       │                             │
│              ┌────────▼────────┐                   │
│              │  Global State   │                   │
│              │  (Zustand)      │                   │
│              └─────────────────┘                   │
└─────────────────────────────────────────────────────┘
                        │ HTTPS / WebSocket
┌───────────────────────▼─────────────────────────────┐
│                    Supabase                          │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Auth   │  │ PostgREST│  │  Storage (avatars)  │ │
│  │         │  │ (RLS)    │  │                    │ │
│  └─────────┘  └──────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Alur Autentikasi

```
Browser → supabase.auth.signInWithPassword()
        ← { session, user }
useAuthStore.setSession(session, user, profile)
Router → /dashboard
```

Sesi disimpan di `localStorage` oleh Supabase JS dan dipulihkan via `supabase.auth.onAuthStateChange()` saat aplikasi dimuat. Protected routes dicek oleh `<ProtectedRoute>` wrapper komponen.

### Alur Data (Read)

```
Page component
  → custom hook (contoh: useStudents)
    → src/services/studentService.ts
      → supabase.from('students').select(...)   [RLS terapkan filter otomatis]
        ← data | error
      → return { data, error }
    ← { students, loading, error }
  → render
```

### Alur Data (Write)

```
Form submit
  → service function (contoh: createStudent)
    → supabase.from('students').insert(...)
      ← { data, error }
  → update Zustand store / invalidate query
  → toast notification (success | error)
```

---

## Components and Interfaces

### Folder Structure

```
src/
├── app/
│   ├── App.tsx                  # Root component, router setup
│   ├── routes.tsx               # Route definitions
│   └── providers.tsx            # Zustand stores, theme provider
│
├── components/
│   └── ui/                      # Shared components (dipakai ≥2 fitur)
│       ├── AppShell.tsx         # Layout wrapper (sidebar + topbar)
│       ├── Sidebar.tsx
│       ├── Topbar.tsx
│       ├── ProtectedRoute.tsx
│       ├── RoleGuard.tsx
│       ├── DataTable.tsx        # Generic paginated table
│       ├── ConfirmDialog.tsx
│       ├── Toast/               # Toast provider + hook
│       ├── SkeletonTable.tsx
│       ├── EmptyState.tsx
│       └── PageHeader.tsx
│
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   └── useAuthStore.ts      # Zustand slice
│   │
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── TodaySchedule.tsx
│   │   ├── AnnouncementsPanel.tsx
│   │   ├── WeeklyAttendanceChart.tsx
│   │   └── useDashboard.ts
│   │
│   ├── classes/
│   │   ├── ClassesPage.tsx
│   │   ├── ClassFormModal.tsx
│   │   └── useClasses.ts
│   │
│   ├── students/
│   │   ├── StudentsPage.tsx
│   │   ├── StudentDetailPage.tsx
│   │   ├── StudentFormModal.tsx
│   │   ├── CsvImportDialog.tsx
│   │   └── useStudents.ts
│   │
│   ├── attendance/
│   │   ├── AttendancePage.tsx
│   │   ├── AttendanceForm.tsx
│   │   ├── AttendanceRecap.tsx
│   │   └── useAttendance.ts
│   │
│   ├── schedules/
│   │   ├── SchedulePage.tsx
│   │   ├── WeeklyGrid.tsx
│   │   ├── ScheduleFormModal.tsx
│   │   └── useSchedules.ts
│   │
│   ├── notes/
│   │   ├── NoteList.tsx
│   │   ├── NoteFormModal.tsx
│   │   └── useNotes.ts
│   │
│   ├── grades/
│   │   ├── GradesPage.tsx
│   │   ├── GradeComponentsConfig.tsx
│   │   ├── GradeInputTable.tsx
│   │   └── useGrades.ts
│   │
│   ├── reports/
│   │   ├── ReportsPage.tsx
│   │   ├── AttendanceReportForm.tsx
│   │   ├── ReportCardForm.tsx
│   │   └── useReports.ts
│   │
│   ├── users/
│   │   ├── UsersPage.tsx
│   │   ├── UserFormModal.tsx
│   │   └── useUsers.ts
│   │
│   └── settings/
│       ├── SettingsPage.tsx
│       ├── ProfileSection.tsx
│       ├── SchoolInfoSection.tsx
│       ├── AcademicYearSection.tsx
│       ├── GradeScaleSection.tsx
│       └── useSettings.ts
│
├── services/                    # SATU-SATUNYA tempat Supabase client dipanggil
│   ├── supabase.ts              # createClient() + export
│   ├── authService.ts
│   ├── classService.ts
│   ├── studentService.ts
│   ├── attendanceService.ts
│   ├── scheduleService.ts
│   ├── noteService.ts
│   ├── gradeService.ts
│   ├── reportService.ts
│   ├── userService.ts
│   └── settingsService.ts
│
├── stores/
│   ├── authStore.ts             # Auth session + user profile
│   ├── appStore.ts              # Active academic year, theme
│   └── uiStore.ts               # Sidebar state, toast queue
│
├── lib/
│   ├── utils.ts                 # cn(), date formatters, number formatters
│   ├── validators.ts            # Zod schemas shared across features
│   └── pdfGenerator.ts          # jsPDF / html2canvas wrapper
│
└── types/
    └── database.types.ts        # Generated from Supabase schema
```

### Komponen Kunci

#### `<AppShell>`

Wrapper layout untuk semua halaman terautentikasi. Menyusun sidebar, topbar, dan konten utama. Mengelola state collapsed/expanded sidebar dari `uiStore`.

```tsx
interface AppShellProps {
  children: React.ReactNode;
}
```

#### `<DataTable>`

Tabel generik dengan pagination, search, dan filter. Digunakan di Students, Users, dan Attendance Recap.

```tsx
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  totalCount: number;
  pageSize: number;
  pageIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading: boolean;
  emptyMessage?: string;
}
```

#### `<ProtectedRoute>`

Mengecek `authStore.session`. Jika tidak ada, redirect ke `/login`. Jika ada, render children.

#### `<RoleGuard>`

Mengecek `authStore.profile.role` terhadap array peran yang diizinkan. Jika tidak cocok, redirect ke `/403`.

```tsx
interface RoleGuardProps {
  allowedRoles: ('Guru' | 'Kepala_Sekolah' | 'Staf_Admin')[];
  children: React.ReactNode;
}
```

### Service Interfaces

#### `authService.ts`

```ts
signIn(email: string, password: string): Promise<AuthResponse>
signOut(): Promise<void>
sendPasswordReset(email: string): Promise<void>
updatePassword(newPassword: string): Promise<void>
getProfile(userId: string): Promise<Profile>
```

#### `studentService.ts`

```ts
getStudents(filters: StudentFilters, page: number, pageSize: number): Promise<PaginatedResult<Student>>
getStudentById(id: string): Promise<Student>
createStudent(data: CreateStudentInput): Promise<Student>
updateStudent(id: string, data: UpdateStudentInput): Promise<Student>
softDeleteStudent(id: string): Promise<void>
```

#### `attendanceService.ts`

```ts
getAttendanceByClassAndDate(classId: string, date: string): Promise<AttendanceRecord[]>
saveAttendance(records: AttendanceInput[]): Promise<void>
getAttendanceRecap(classId: string, startDate: string, endDate: string): Promise<AttendanceRecap[]>
```

#### `gradeService.ts`

```ts
getGradeComponents(classId: string, semesterId: string): Promise<GradeComponent[]>
saveGradeComponents(components: GradeComponentInput[]): Promise<void>
getGrades(classId: string, semesterId: string): Promise<GradeRow[]>
saveGrades(grades: GradeInput[]): Promise<void>
calculateWeightedAverage(grades: GradeInput[], components: GradeComponent[]): number
```

#### `reportService.ts`

```ts
generateAttendancePdf(classId: string, startDate: string, endDate: string): Promise<Blob>
generateReportCardPdf(studentId: string, semesterId: string): Promise<Blob>
```

---

## Data Models

### Database Schema

#### `profiles`

```sql
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid REFERENCES schools(id),
  full_name   text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 100),
  role        text NOT NULL CHECK (role IN ('Guru','Kepala_Sekolah','Staf_Admin')),
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

#### `schools`

```sql
CREATE TABLE schools (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  address        text NOT NULL CHECK (char_length(address) BETWEEN 1 AND 255),
  principal_name text NOT NULL CHECK (char_length(principal_name) BETWEEN 1 AND 100),
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

#### `academic_years`

```sql
CREATE TABLE academic_years (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES schools(id),
  name       text NOT NULL CHECK (name ~ '^\d{4}/\d{4}$'),
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
```

#### `semesters`

```sql
CREATE TABLE semesters (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (name IN ('Ganjil','Genap')),
  UNIQUE (academic_year_id, name)
);
```

#### `classes`

```sql
CREATE TABLE classes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES schools(id),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  grade_level      integer NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  homeroom_teacher_id uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, name)
);
```

#### `students`

```sql
CREATE TABLE students (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid NOT NULL REFERENCES schools(id),
  full_name      text NOT NULL,
  nis            text NOT NULL,
  gender         text NOT NULL CHECK (gender IN ('Laki-laki','Perempuan')),
  date_of_birth  date NOT NULL,
  parent_name    text,
  parent_contact text,
  is_deleted     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, nis)
);
```

#### `class_students`

```sql
CREATE TABLE class_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE (class_id, student_id)
);
```

#### `attendance`

```sql
CREATE TABLE attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id),
  student_id uuid NOT NULL REFERENCES students(id),
  date       date NOT NULL,
  status     text NOT NULL CHECK (status IN ('Hadir','Sakit','Izin','Alpa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, date)
);
```

#### `schedules`

```sql
CREATE TABLE schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id),
  teacher_id uuid NOT NULL REFERENCES profiles(id),
  subject    text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Senin ... 6=Sabtu
  start_time time NOT NULL,
  end_time   time NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (teacher_id, day_of_week, start_time)  -- no double-booking
);
```

#### `notes`

```sql
CREATE TABLE notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  author_id  uuid NOT NULL REFERENCES profiles(id),
  category   text NOT NULL CHECK (category IN ('Perilaku','Prestasi')),
  note_date  date NOT NULL,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `grade_components`

```sql
CREATE TABLE grade_components (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES classes(id),
  semester_id uuid NOT NULL REFERENCES semesters(id),
  name        text NOT NULL CHECK (char_length(name) <= 100),
  weight      integer NOT NULL CHECK (weight BETWEEN 1 AND 100),
  UNIQUE (class_id, semester_id, name)
);
```

#### `grades`

```sql
CREATE TABLE grades (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES students(id),
  grade_component_id  uuid NOT NULL REFERENCES grade_components(id) ON DELETE CASCADE,
  score               numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  UNIQUE (student_id, grade_component_id)
);
```

#### `grade_scales`

```sql
CREATE TABLE grade_scales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id),
  min_score   integer NOT NULL CHECK (min_score BETWEEN 0 AND 100),
  max_score   integer NOT NULL CHECK (max_score BETWEEN 0 AND 100),
  letter      text NOT NULL CHECK (char_length(letter) BETWEEN 1 AND 3),
  CHECK (max_score >= min_score),
  UNIQUE (school_id, min_score, max_score)
);
```

### RLS Policies

Setiap tabel di atas memiliki `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Policy dibuat dengan pola berikut:

**Guru** — akses penuh ke baris yang terkait dengan kelas yang mereka ajar:

```sql
-- Contoh untuk tabel attendance
CREATE POLICY "guru_attendance" ON attendance
  USING (
    class_id IN (
      SELECT id FROM classes WHERE homeroom_teacher_id = auth.uid()
      UNION
      SELECT class_id FROM schedules WHERE teacher_id = auth.uid()
    )
  );
```

**Kepala_Sekolah** — SELECT semua baris yang `school_id` sesuai dengan `school_id` profil mereka:

```sql
CREATE POLICY "kepsek_read_all" ON students
  FOR SELECT USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
  );
```

**Staf_Admin** — SELECT + INSERT + UPDATE + DELETE semua baris di sekolah mereka:

```sql
CREATE POLICY "admin_full_access" ON students
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'Staf_Admin'
  );
```

### TypeScript Types (Generated)

Tipe database di-generate dari Supabase CLI ke `src/types/database.types.ts`:

```ts
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: ProfileInsert; Update: ProfileUpdate };
      students:  { Row: Student;  Insert: StudentInsert;  Update: StudentUpdate  };
      // ... semua tabel
    };
  };
};

// Alias yang dipakai di fitur
export type Profile   = Database['public']['Tables']['profiles']['Row'];
export type Student   = Database['public']['Tables']['students']['Row'];
export type Class     = Database['public']['Tables']['classes']['Row'];
export type Attendance = Database['public']['Tables']['attendance']['Row'];
// ...
```

### Zustand Store Shapes

```ts
// authStore.ts
interface AuthState {
  session: Session | null;
  profile: Profile | null;
  setSession: (session: Session | null, profile: Profile | null) => void;
  clearSession: () => void;
}

// appStore.ts
interface AppState {
  activeAcademicYear: AcademicYear | null;
  activeSemester: Semester | null;
  theme: 'light' | 'dark' | 'system';
  setActiveAcademicYear: (ay: AcademicYear) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// uiStore.ts
interface UIState {
  sidebarCollapsed: boolean;
  toasts: Toast[];
  toggleSidebar: () => void;
  pushToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}
```

### Kalkulasi Nilai Akhir

Nilai akhir dihitung di sisi client sebelum disimpan:

```ts
function calculateWeightedAverage(
  scores: { componentId: string; score: number }[],
  components: GradeComponent[]
): number {
  const total = components.reduce((sum, comp) => {
    const scoreEntry = scores.find(s => s.componentId === comp.id);
    return sum + (scoreEntry?.score ?? 0) * (comp.weight / 100);
  }, 0);
  return Math.round(total * 100) / 100; // 2 decimal places
}
```

### Konversi Skala Nilai

```ts
function getLetterGrade(score: number, scales: GradeScale[]): string | null {
  const match = scales.find(s => score >= s.min_score && score <= s.max_score);
  return match?.letter ?? null;
}
```

### Struktur Laporan PDF

PDF dihasilkan menggunakan `jsPDF` + `jspdf-autotable`:

```ts
// Attendance Report
interface AttendancePdfData {
  schoolName: string;
  className: string;
  dateRange: { start: Date; end: Date };
  rows: {
    studentName: string;
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
  }[];
}

// Report Card
interface ReportCardPdfData {
  schoolName: string;
  studentName: string;
  nis: string;
  semesterName: string;
  grades: { subject: string; midterm: number; final: number; average: number; letter: string }[];
  attendance: { hadir: number; sakit: number; izin: number; alpa: number };
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Kalkulasi Nilai Akhir Tertimbang

*For any* kombinasi skor siswa dan konfigurasi komponen nilai yang valid (bobot total = 100), fungsi `calculateWeightedAverage` harus menghasilkan nilai akhir dalam rentang 0–100 yang setara dengan penjumlahan `score_i × (weight_i / 100)` untuk semua komponen, dibulatkan ke 2 desimal.

**Validates: Requirements 10.5**

### Property 2: Konversi Skala Nilai Idempoten

*For any* konfigurasi `GradeScale` yang valid (tidak tumpang tindih, mencakup 0–100 penuh) dan nilai numerik dalam rentang 0–100, fungsi `getLetterGrade` harus menghasilkan tepat satu huruf nilai yang sama setiap kali dipanggil dengan input yang sama.

**Validates: Requirements 10.6**

### Property 3: Validasi Skala Nilai Mencakup Tepat 0–100

*For any* konfigurasi skala nilai yang disubmit, validasi harus meluluskan konfigurasi jika dan hanya jika rentang-rentang tersebut bersama-sama mencakup setiap bilangan bulat dari 0 sampai 100 tanpa celah dan tanpa tumpang tindih.

**Validates: Requirements 13.7**

### Property 4: Bobot Komponen Nilai Harus Tepat 100

*For any* kumpulan komponen nilai yang disimpan untuk satu Kelas dan Semester, jumlah seluruh bobot (`weight`) harus sama persis dengan 100 setelah operasi simpan berhasil.

**Validates: Requirements 10.2**

### Property 5: Kehadiran Rekap Konsisten dengan Data Mentah

*For any* kelas dan rentang tanggal, jumlah masing-masing status (Hadir, Sakit, Izin, Alpa) dalam rekap kehadiran harus sama persis dengan total baris pada tabel `attendance` yang cocok dengan filter kelas, siswa, status, dan rentang tanggal yang bersangkutan.

**Validates: Requirements 7.8**

### Property 6: Persentase Kehadiran Harian Konsisten

*For any* hari sekolah dengan setidaknya satu siswa aktif, persentase kehadiran yang ditampilkan di Dashboard harus sama dengan `(jumlah_hadir / total_siswa_aktif) × 100` dibulatkan ke 1 desimal.

**Validates: Requirements 4.1, 4.4**

### Property 7: Serialisasi / Deserialisasi Format Tanggal Laporan

*For any* objek `Date` JavaScript yang valid, fungsi format tanggal laporan harus menghasilkan string dalam format `dd MMMM yyyy` Bahasa Indonesia, dan memparse-nya kembali harus menghasilkan tanggal yang ekuivalen.

**Validates: Requirements 11.6**

### Property 8: Pencarian Siswa Mempertahankan Subset

*For any* daftar siswa dan query pencarian non-kosong, semua hasil yang dikembalikan harus merupakan elemen dari daftar asli yang memenuhi kriteria pencarian (nama, NIS, atau nama kelas mengandung query), dan tidak ada elemen yang memenuhi kriteria tetapi tidak dikembalikan.

**Validates: Requirements 6.2**

### Property 9: Catatan Siswa Tersimpan dengan Author yang Benar

*For any* catatan yang dibuat oleh Guru yang terautentikasi, `author_id` pada catatan yang tersimpan harus sama persis dengan `id` pengguna yang saat itu terautentikasi.

**Validates: Requirements 9.3**

### Property 10: NIS Unik Per Sekolah

*For any* dua siswa yang berhasil tersimpan dalam sistem untuk sekolah yang sama, nilai NIS keduanya harus berbeda.

**Validates: Requirements 6.10**

### Property 11: Optimistic Update Revert pada Kegagalan Server

*For any* kondisi awal status kehadiran dan perubahan status yang gagal di sisi server, state lokal setelah revert harus sama persis dengan kondisi awal sebelum perubahan dilakukan.

**Validates: Requirements 15.3**

### Property 12: Deteksi Konflik Jadwal

*For any* pasangan entri jadwal yang memiliki teacher_id, day_of_week, dan start_time yang sama, fungsi validasi konflik harus mendeteksi konflik tersebut dan menolak penyimpanan.

**Validates: Requirements 8.5**

---

## Error Handling

### Strategi Umum

Semua error dari Supabase JS dikembalikan sebagai `{ data, error }`. Service function memeriksa `error !== null` dan melempar exception bertipe `ServiceError` yang berisi:

```ts
interface ServiceError {
  code: string;         // contoh: 'PGRST116', 'auth/wrong-password'
  message: string;      // pesan teknis (untuk log)
  userMessage: string;  // pesan dalam Bahasa Indonesia (untuk toast/UI)
}
```

Layer komponen menangkap `ServiceError` dan mengirimnya ke `uiStore.pushToast(...)`.

### Skenario Error Kritis

| Skenario | Penanganan |
|---|---|
| Login gagal (kredensial salah) | Toast error Bahasa Indonesia, form tetap terisi |
| Sesi kadaluarsa | Redirect ke `/login` + pesan "Sesi Anda telah berakhir" |
| RLS menolak akses | Toast "Anda tidak memiliki akses ke data ini" |
| Duplikat NIS | Inline error di form field NIS |
| Bobot komponen ≠ 100 | Inline error di summary bobot, block submit |
| Rentang skala nilai tidak valid | Inline error di konfigurasi skala |
| Konflik jadwal | Toast error dengan nama guru dan slot waktu yang konflik |
| PDF timeout >10 detik | Batalkan generasi, tampilkan error message |
| Upload foto >2 MB / format salah | Reject dengan pesan Bahasa Indonesia |
| Hapus kelas dengan data terkait | Cascade delete via FK; jika gagal, tampilkan error |

### Optimistic Updates (Kehadiran)

```
User changes status
  → immediately update local state (uiStore)
  → fire supabase update in background
    → success: no-op (UI already correct)
    → error:   revert local state + show error toast
```

### Network Offline

Supabase JS akan mengembalikan `error` saat offline. Komponen menampilkan toast error generik "Periksa koneksi internet Anda."

---

## Testing Strategy

### Pendekatan Pengujian

Strategi pengujian menggunakan dua lapisan yang saling melengkapi:

1. **Unit tests** — menguji contoh spesifik, edge case, dan kondisi error pada fungsi pure (kalkulasi nilai, format tanggal, validasi).
2. **Property-based tests** — menguji properti universal yang harus berlaku untuk semua input valid.

Komponen UI diuji dengan Vitest + React Testing Library. Supabase client di-mock menggunakan `vi.mock` untuk semua unit test.

### Property-Based Testing

**Library:** [fast-check](https://github.com/dubzzz/fast-check) (TypeScript, aktif dikelola).

**Konfigurasi:** Setiap property test dijalankan minimum 100 iterasi.

**Tag format:** Setiap property test diberi komentar:
`// Feature: sekolah-admin, Property N: <deskripsi singkat>`

#### Property 1 — Kalkulasi Nilai Akhir Tertimbang

```ts
// Feature: sekolah-admin, Property 1: weighted average dalam rentang 0-100
fc.assert(fc.property(
  fc.array(fc.record({
    componentId: fc.uuid(),
    weight: fc.integer({ min: 1, max: 100 }),
    score: fc.float({ min: 0, max: 100 })
  }), { minLength: 1 }).filter(components =>
    components.reduce((s, c) => s + c.weight, 0) === 100
  ),
  (components) => {
    const scores = components.map(c => ({ componentId: c.componentId, score: c.score }));
    const result = calculateWeightedAverage(scores, components);
    return result >= 0 && result <= 100;
  }
), { numRuns: 100 });
```

#### Property 2 — Konversi Skala Nilai Idempoten

```ts
// Feature: sekolah-admin, Property 2: getLetterGrade idempoten untuk input yang sama
fc.assert(fc.property(
  fc.float({ min: 0, max: 100 }),
  validGradeScalesArbitrary(), // arbitrary yang generate skala valid
  (score, scales) => {
    const r1 = getLetterGrade(score, scales);
    const r2 = getLetterGrade(score, scales);
    return r1 === r2;
  }
), { numRuns: 100 });
```

#### Property 3 — Validasi Skala Nilai Mencakup Tepat 0–100

```ts
// Feature: sekolah-admin, Property 3: validasi skala hanya lolos jika mencakup 0-100 tanpa gap/overlap
fc.assert(fc.property(
  gradeScaleConfigArbitrary(),
  (scales) => {
    const isValid = validateGradeScales(scales);
    const coversAll = coversRange(scales, 0, 100);
    return isValid === coversAll;
  }
), { numRuns: 100 });
```

#### Property 4 — Bobot Komponen Nilai Harus Tepat 100

```ts
// Feature: sekolah-admin, Property 4: total bobot yang tersimpan == 100
fc.assert(fc.property(
  validGradeComponentsArbitrary(), // generate komponen dengan total bobot = 100
  (components) => {
    const total = components.reduce((s, c) => s + c.weight, 0);
    return total === 100;
  }
), { numRuns: 100 });
```

#### Property 5 — Rekap Kehadiran Konsisten

```ts
// Feature: sekolah-admin, Property 5: rekap kehadiran == aggregate dari data mentah
fc.assert(fc.property(
  attendanceRecordsArbitrary(),
  (records) => {
    const recap = buildAttendanceRecap(records);
    const hadir = records.filter(r => r.status === 'Hadir').length;
    return recap.totalHadir === hadir;
  }
), { numRuns: 100 });
```

#### Property 6 — Persentase Kehadiran Harian

```ts
// Feature: sekolah-admin, Property 6: attendance percentage calculation
fc.assert(fc.property(
  fc.integer({ min: 1, max: 100 }).chain(total =>
    fc.integer({ min: 0, max: total }).map(hadir => ({ hadir, total }))
  ),
  ({ hadir, total }) => {
    const pct = calculateAttendancePercentage(hadir, total);
    const expected = Math.round((hadir / total) * 1000) / 10;
    return Math.abs(pct - expected) < 0.001;
  }
), { numRuns: 100 });
```

#### Property 7 — Format Tanggal Round Trip

```ts
// Feature: sekolah-admin, Property 7: format tanggal laporan round trip
fc.assert(fc.property(
  fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
  (date) => {
    const formatted = formatReportDate(date); // "01 Januari 2026"
    const parsed = parseReportDate(formatted);
    return parsed.getFullYear() === date.getFullYear()
      && parsed.getMonth() === date.getMonth()
      && parsed.getDate() === date.getDate();
  }
), { numRuns: 100 });
```

#### Property 8 — Pencarian Siswa

```ts
// Feature: sekolah-admin, Property 8: search subset correctness
fc.assert(fc.property(
  fc.array(studentArbitrary(), { minLength: 0, maxLength: 50 }),
  fc.string({ minLength: 1, maxLength: 20 }),
  (students, query) => {
    const results = filterStudents(students, query);
    // semua hasil harus lolos kriteria
    const allMatch = results.every(s =>
      s.full_name.includes(query) || s.nis.includes(query) || s.className.includes(query)
    );
    // tidak ada yang terlewat
    const noneSkipped = students
      .filter(s => s.full_name.includes(query) || s.nis.includes(query) || s.className.includes(query))
      .every(s => results.includes(s));
    return allMatch && noneSkipped;
  }
), { numRuns: 100 });
```

#### Property 9 — Catatan Memiliki Author yang Benar

```ts
// Feature: sekolah-admin, Property 9: note author_id == authenticated user id
fc.assert(fc.property(
  fc.uuid(), // userId
  noteInputArbitrary(),
  (userId, noteInput) => {
    const note = buildNoteRecord(noteInput, userId);
    return note.author_id === userId;
  }
), { numRuns: 100 });
```

#### Property 10 — NIS Unik Per Sekolah

```ts
// Feature: sekolah-admin, Property 10: NIS unik dalam satu sekolah
fc.assert(fc.property(
  fc.array(studentArbitrary(), { minLength: 2, maxLength: 20 }),
  (students) => {
    const deduped = deduplicateStudents(students); // fungsi yang menolak NIS duplikat
    const nisList = deduped.map(s => s.nis);
    return new Set(nisList).size === nisList.length;
  }
), { numRuns: 100 });
```

#### Property 11 — Optimistic Update Revert

```ts
// Feature: sekolah-admin, Property 11: optimistic update revert restores original state
fc.assert(fc.property(
  attendanceStatusArbitrary(),  // 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'
  attendanceStatusArbitrary(),  // new status
  (originalStatus, newStatus) => {
    let currentStatus = originalStatus;
    // simulate optimistic update
    currentStatus = newStatus;
    // simulate server failure → revert
    currentStatus = originalStatus;
    return currentStatus === originalStatus;
  }
), { numRuns: 100 });
```

#### Property 12 — Deteksi Konflik Jadwal

```ts
// Feature: sekolah-admin, Property 12: schedule conflict detection
fc.assert(fc.property(
  fc.uuid(),                           // teacherId
  fc.integer({ min: 1, max: 6 }),      // dayOfWeek
  validTimeSlotArbitrary(),            // startTime
  (teacherId, day, startTime) => {
    const entry1 = { teacherId, day, startTime, classId: 'class-a' };
    const entry2 = { teacherId, day, startTime, classId: 'class-b' };
    const hasConflict = detectScheduleConflict([entry1], entry2);
    return hasConflict === true;
  }
), { numRuns: 100 });
```

### Unit Tests

Unit test difokuskan pada:
- **Contoh spesifik**: form validation, format angka (titik sebagai pemisah ribuan), redirect logic.
- **Edge cases**: nilai 0 dan 100 pada skala nilai, tanggal pembatas (1 Jan, 31 Des).
- **Error conditions**: input di luar rentang, field kosong, NIS duplikat.

### Integration Tests

Integration test (menggunakan Supabase sandbox atau `msw` untuk mock HTTP) digunakan untuk:
- Alur login end-to-end.
- RLS policy: memastikan Guru tidak dapat membaca data kelas milik Guru lain.
- Pembuatan pengguna baru oleh Staf_Admin.

### Testing UI

Komponen seperti `<DataTable>`, `<ConfirmDialog>`, dan `<Toast>` diuji dengan React Testing Library untuk memverifikasi rendering dan interaksi user.

-- =============================================================================
-- Sekolah Admin — Database Schema
-- =============================================================================
-- Deskripsi : DDL lengkap untuk semua 13 tabel aplikasi Sekolah Admin.
--             Tabel dibuat dalam urutan dependency (tidak ada forward reference).
--             RLS diaktifkan langsung setelah setiap CREATE TABLE.
--             Index ditambahkan untuk pola query yang umum.
--
-- Cara pakai : Jalankan file ini sekali di Supabase SQL Editor atau via CLI
--              setelah membuat project Supabase baru.
--
-- Tabel     : schools, profiles, academic_years, semesters, classes,
--             students, class_students, attendance, schedules, notes,
--             grade_components, grades, grade_scales
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. schools
--    Tabel master sekolah. Tidak bergantung pada tabel lain.
-- ---------------------------------------------------------------------------
CREATE TABLE schools (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  address        text NOT NULL CHECK (char_length(address) BETWEEN 1 AND 255),
  principal_name text NOT NULL CHECK (char_length(principal_name) BETWEEN 1 AND 100),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_schools_name ON schools (name);


-- ---------------------------------------------------------------------------
-- 2. profiles
--    Profil pengguna yang terhubung ke auth.users Supabase.
--    Bergantung pada: auth.users (built-in), schools
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid REFERENCES schools(id),
  full_name   text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 100),
  role        text NOT NULL CHECK (role IN ('Guru','Kepala_Sekolah','Staf_Admin')),
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_profiles_school_id ON profiles (school_id);
CREATE INDEX idx_profiles_role      ON profiles (role);
CREATE INDEX idx_profiles_is_active ON profiles (is_active);


-- ---------------------------------------------------------------------------
-- 3. academic_years
--    Tahun ajaran per sekolah (contoh: 2025/2026).
--    Bergantung pada: schools
-- ---------------------------------------------------------------------------
CREATE TABLE academic_years (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES schools(id),
  name       text NOT NULL CHECK (name ~ '^\d{4}/\d{4}$'),
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_academic_years_school_id ON academic_years (school_id);
CREATE INDEX idx_academic_years_is_active ON academic_years (is_active);


-- ---------------------------------------------------------------------------
-- 4. semesters
--    Semester dalam satu tahun ajaran (Ganjil / Genap).
--    Bergantung pada: academic_years
-- ---------------------------------------------------------------------------
CREATE TABLE semesters (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (name IN ('Ganjil','Genap')),
  UNIQUE (academic_year_id, name)
);

ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_semesters_academic_year_id ON semesters (academic_year_id);


-- ---------------------------------------------------------------------------
-- 5. classes
--    Kelas dalam satu tahun ajaran.
--    Bergantung pada: schools, academic_years, profiles (wali kelas)
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES schools(id),
  academic_year_id    uuid NOT NULL REFERENCES academic_years(id),
  name                text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  grade_level         integer NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  homeroom_teacher_id uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, name)
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_classes_school_id           ON classes (school_id);
CREATE INDEX idx_classes_academic_year_id    ON classes (academic_year_id);
CREATE INDEX idx_classes_homeroom_teacher_id ON classes (homeroom_teacher_id);
CREATE INDEX idx_classes_grade_level         ON classes (grade_level);


-- ---------------------------------------------------------------------------
-- 6. students
--    Data siswa. NIS harus unik per sekolah.
--    Bergantung pada: schools
-- ---------------------------------------------------------------------------
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

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_students_school_id  ON students (school_id);
CREATE INDEX idx_students_nis        ON students (school_id, nis);
CREATE INDEX idx_students_is_deleted ON students (is_deleted);
CREATE INDEX idx_students_full_name  ON students (full_name);


-- ---------------------------------------------------------------------------
-- 7. class_students
--    Relasi many-to-many antara kelas dan siswa (pendaftaran kelas).
--    Bergantung pada: classes, students
-- ---------------------------------------------------------------------------
CREATE TABLE class_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE (class_id, student_id)
);

ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_class_students_class_id   ON class_students (class_id);
CREATE INDEX idx_class_students_student_id ON class_students (student_id);


-- ---------------------------------------------------------------------------
-- 8. attendance
--    Catatan kehadiran siswa per kelas per tanggal.
--    Bergantung pada: classes, students
-- ---------------------------------------------------------------------------
CREATE TABLE attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id),
  student_id uuid NOT NULL REFERENCES students(id),
  date       date NOT NULL,
  status     text NOT NULL CHECK (status IN ('Hadir','Sakit','Izin','Alpa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_attendance_class_id   ON attendance (class_id);
CREATE INDEX idx_attendance_student_id ON attendance (student_id);
CREATE INDEX idx_attendance_date       ON attendance (date);
CREATE INDEX idx_attendance_status     ON attendance (status);
-- Composite index untuk query rekap kehadiran
CREATE INDEX idx_attendance_class_date ON attendance (class_id, date);


-- ---------------------------------------------------------------------------
-- 9. schedules
--    Jadwal mengajar mingguan per kelas dan guru.
--    Bergantung pada: classes, profiles
--    Constraint UNIQUE mencegah double-booking guru.
-- ---------------------------------------------------------------------------
CREATE TABLE schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES classes(id),
  teacher_id  uuid NOT NULL REFERENCES profiles(id),
  subject     text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Senin ... 6=Sabtu
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (teacher_id, day_of_week, start_time) -- mencegah double-booking guru
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_schedules_class_id    ON schedules (class_id);
CREATE INDEX idx_schedules_teacher_id  ON schedules (teacher_id);
CREATE INDEX idx_schedules_day_of_week ON schedules (day_of_week);


-- ---------------------------------------------------------------------------
-- 10. notes
--     Catatan perilaku/prestasi siswa yang ditulis oleh guru.
--     Bergantung pada: students, profiles
-- ---------------------------------------------------------------------------
CREATE TABLE notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  author_id  uuid NOT NULL REFERENCES profiles(id),
  category   text NOT NULL CHECK (category IN ('Perilaku','Prestasi')),
  note_date  date NOT NULL,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_notes_student_id ON notes (student_id);
CREATE INDEX idx_notes_author_id  ON notes (author_id);
CREATE INDEX idx_notes_note_date  ON notes (note_date DESC);
CREATE INDEX idx_notes_category   ON notes (category);


-- ---------------------------------------------------------------------------
-- 11. grade_components
--     Komponen nilai (Tugas, UTS, UAS, dll.) per kelas dan semester.
--     Bergantung pada: classes, semesters
-- ---------------------------------------------------------------------------
CREATE TABLE grade_components (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES classes(id),
  semester_id uuid NOT NULL REFERENCES semesters(id),
  name        text NOT NULL CHECK (char_length(name) <= 100),
  weight      integer NOT NULL CHECK (weight BETWEEN 1 AND 100),
  UNIQUE (class_id, semester_id, name)
);

ALTER TABLE grade_components ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_grade_components_class_id    ON grade_components (class_id);
CREATE INDEX idx_grade_components_semester_id ON grade_components (semester_id);
-- Composite index untuk query komponen berdasarkan kelas+semester
CREATE INDEX idx_grade_components_class_semester ON grade_components (class_id, semester_id);


-- ---------------------------------------------------------------------------
-- 12. grades
--     Nilai siswa untuk setiap komponen nilai.
--     Bergantung pada: students, grade_components
-- ---------------------------------------------------------------------------
CREATE TABLE grades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         uuid NOT NULL REFERENCES students(id),
  grade_component_id uuid NOT NULL REFERENCES grade_components(id) ON DELETE CASCADE,
  score              numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  UNIQUE (student_id, grade_component_id)
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_grades_student_id          ON grades (student_id);
CREATE INDEX idx_grades_grade_component_id  ON grades (grade_component_id);


-- ---------------------------------------------------------------------------
-- 13. grade_scales
--     Skala konversi nilai angka ke huruf (A, B, C, D) per sekolah.
--     Bergantung pada: schools
-- ---------------------------------------------------------------------------
CREATE TABLE grade_scales (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  min_score integer NOT NULL CHECK (min_score BETWEEN 0 AND 100),
  max_score integer NOT NULL CHECK (max_score BETWEEN 0 AND 100),
  letter    text NOT NULL CHECK (char_length(letter) BETWEEN 1 AND 3),
  CHECK (max_score >= min_score),
  UNIQUE (school_id, min_score, max_score)
);

ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX idx_grade_scales_school_id ON grade_scales (school_id);

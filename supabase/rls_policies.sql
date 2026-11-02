-- =============================================================================
-- Sekolah Admin — Row Level Security (RLS) Policies
-- =============================================================================
-- Deskripsi : RLS policies untuk tiga peran: Guru, Kepala_Sekolah, Staf_Admin.
--             RLS sudah diaktifkan di schema.sql (ALTER TABLE ... ENABLE ROW LEVEL SECURITY).
--             File ini hanya berisi CREATE POLICY statements.
--
-- Peran     :
--   Guru          — akses penuh ke baris yang terkait dengan kelas yang diajarnya
--                   (via homeroom_teacher_id ATAU schedules.teacher_id)
--   Kepala_Sekolah — SELECT semua baris di sekolahnya sendiri (school_id cocok)
--   Staf_Admin    — SELECT/INSERT/UPDATE/DELETE semua baris di sekolahnya sendiri
--
-- Cara pakai: Jalankan file ini setelah schema.sql di Supabase SQL Editor / CLI.
--
-- Tabel     : schools, profiles, academic_years, semesters, classes,
--             students, class_students, attendance, schedules, notes,
--             grade_components, grades, grade_scales
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: subquery yang mengembalikan school_id user yang sedang login
-- ---------------------------------------------------------------------------
-- Dipakai berulang di banyak policy sebagai:
--   (SELECT school_id FROM profiles WHERE id = auth.uid())


-- =============================================================================
-- 1. schools
-- =============================================================================

-- Guru: tidak punya akses langsung ke tabel schools (tidak ada school_id di baris
--        yang "dimiliki" guru). Guru membaca school melalui join implisit di UI.
--        Namun agar query JOIN tidak error, berikan SELECT ke baris sekolah mereka.
CREATE POLICY "guru_schools_select" ON schools
  FOR SELECT
  USING (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Guru')
  );

-- Kepala_Sekolah: SELECT sekolah miliknya
CREATE POLICY "kepsek_schools_select" ON schools
  FOR SELECT
  USING (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Kepala_Sekolah')
  );

-- Staf_Admin: full access ke sekolah miliknya
CREATE POLICY "admin_schools_select" ON schools
  FOR SELECT
  USING (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_schools_insert" ON schools
  FOR INSERT
  WITH CHECK (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_schools_update" ON schools
  FOR UPDATE
  USING (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Staf_Admin')
  )
  WITH CHECK (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_schools_delete" ON schools
  FOR DELETE
  USING (
    id = (SELECT school_id FROM profiles WHERE id = auth.uid()
          AND role = 'Staf_Admin')
  );


-- =============================================================================
-- 2. profiles
-- =============================================================================

-- Guru: SELECT profil mereka sendiri + profil di sekolah yang sama
--       (dibutuhkan untuk menampilkan nama guru lain di jadwal, dsb.)
CREATE POLICY "guru_profiles_select" ON profiles
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Guru')
  );

-- Guru: UPDATE hanya profil diri sendiri
CREATE POLICY "guru_profiles_update_self" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kepala_Sekolah: SELECT semua profil di sekolahnya
CREATE POLICY "kepsek_profiles_select" ON profiles
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Kepala_Sekolah')
  );

-- Staf_Admin: full access ke profil di sekolahnya
CREATE POLICY "admin_profiles_select" ON profiles
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_profiles_insert" ON profiles
  FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_profiles_update" ON profiles
  FOR UPDATE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_profiles_delete" ON profiles
  FOR DELETE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );


-- =============================================================================
-- 3. academic_years
-- =============================================================================

-- Guru: SELECT tahun ajaran di sekolahnya (dibutuhkan untuk query kelas, dsb.)
CREATE POLICY "guru_academic_years_select" ON academic_years
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Guru')
  );

-- Kepala_Sekolah: SELECT semua tahun ajaran di sekolahnya
CREATE POLICY "kepsek_academic_years_select" ON academic_years
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Kepala_Sekolah')
  );

-- Staf_Admin: full access ke tahun ajaran di sekolahnya
CREATE POLICY "admin_academic_years_select" ON academic_years
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_academic_years_insert" ON academic_years
  FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_academic_years_update" ON academic_years
  FOR UPDATE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_academic_years_delete" ON academic_years
  FOR DELETE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );


-- =============================================================================
-- 4. semesters
-- =============================================================================
-- semesters tidak punya school_id langsung; school_id ada di academic_years.
-- Akses dikontrol via JOIN ke academic_years.

-- Guru: SELECT semester yang terkait dengan tahun ajaran di sekolahnya
CREATE POLICY "guru_semesters_select" ON semesters
  FOR SELECT
  USING (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Guru')
    )
  );

-- Kepala_Sekolah: SELECT semua semester di sekolahnya
CREATE POLICY "kepsek_semesters_select" ON semesters
  FOR SELECT
  USING (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Kepala_Sekolah')
    )
  );

-- Staf_Admin: full access ke semester di sekolahnya
CREATE POLICY "admin_semesters_select" ON semesters
  FOR SELECT
  USING (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_semesters_insert" ON semesters
  FOR INSERT
  WITH CHECK (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_semesters_update" ON semesters
  FOR UPDATE
  USING (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  )
  WITH CHECK (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_semesters_delete" ON semesters
  FOR DELETE
  USING (
    academic_year_id IN (
      SELECT id FROM academic_years
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );


-- =============================================================================
-- 5. classes
-- =============================================================================
-- Guru mengajar kelas jika:
--   (a) dia adalah wali kelas (homeroom_teacher_id = auth.uid()), ATAU
--   (b) dia memiliki entri di tabel schedules untuk kelas tersebut

-- Guru: full access ke kelas yang diajarnya
CREATE POLICY "guru_classes_all" ON classes
  USING (
    homeroom_teacher_id = auth.uid()
    OR id IN (
      SELECT class_id FROM schedules WHERE teacher_id = auth.uid()
    )
  );

-- Kepala_Sekolah: SELECT semua kelas di sekolahnya
CREATE POLICY "kepsek_classes_select" ON classes
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Kepala_Sekolah')
  );

-- Staf_Admin: full access ke kelas di sekolahnya
CREATE POLICY "admin_classes_select" ON classes
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_classes_insert" ON classes
  FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_classes_update" ON classes
  FOR UPDATE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_classes_delete" ON classes
  FOR DELETE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );


-- =============================================================================
-- 6. students
-- =============================================================================

-- Guru: akses ke siswa yang terdaftar di kelas yang diajarnya
CREATE POLICY "guru_students_all" ON students
  USING (
    id IN (
      SELECT cs.student_id
      FROM class_students cs
      JOIN classes c ON c.id = cs.class_id
      WHERE c.homeroom_teacher_id = auth.uid()
         OR c.id IN (SELECT class_id FROM schedules WHERE teacher_id = auth.uid())
    )
  );

-- Kepala_Sekolah: SELECT semua siswa di sekolahnya
CREATE POLICY "kepsek_students_select" ON students
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Kepala_Sekolah')
  );

-- Staf_Admin: full access ke siswa di sekolahnya
CREATE POLICY "admin_students_select" ON students
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_students_insert" ON students
  FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_students_update" ON students
  FOR UPDATE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_students_delete" ON students
  FOR DELETE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );


-- =============================================================================
-- 7. class_students
-- =============================================================================

-- Guru: akses ke pendaftaran kelas yang diajarnya
CREATE POLICY "guru_class_students_all" ON class_students
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE homeroom_teacher_id = auth.uid()
         OR id IN (SELECT class_id FROM schedules WHERE teacher_id = auth.uid())
    )
  );

-- Kepala_Sekolah: SELECT pendaftaran kelas di sekolahnya
CREATE POLICY "kepsek_class_students_select" ON class_students
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Kepala_Sekolah')
    )
  );

-- Staf_Admin: full access ke pendaftaran kelas di sekolahnya
CREATE POLICY "admin_class_students_select" ON class_students
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_class_students_insert" ON class_students
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_class_students_update" ON class_students
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_class_students_delete" ON class_students
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );


-- =============================================================================
-- 8. attendance
-- =============================================================================

-- Guru: full access ke kehadiran di kelas yang diajarnya
CREATE POLICY "guru_attendance_all" ON attendance
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE homeroom_teacher_id = auth.uid()
         OR id IN (SELECT class_id FROM schedules WHERE teacher_id = auth.uid())
    )
  );

-- Kepala_Sekolah: SELECT semua kehadiran di sekolahnya
CREATE POLICY "kepsek_attendance_select" ON attendance
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Kepala_Sekolah')
    )
  );

-- Staf_Admin: full access ke kehadiran di sekolahnya
CREATE POLICY "admin_attendance_select" ON attendance
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_attendance_insert" ON attendance
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_attendance_update" ON attendance
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_attendance_delete" ON attendance
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );


-- =============================================================================
-- 9. schedules
-- =============================================================================

-- Guru: full access ke jadwal di kelas yang diajarnya
--       (termasuk jadwal guru lain di kelas yang sama agar tampil di UI)
CREATE POLICY "guru_schedules_all" ON schedules
  USING (
    teacher_id = auth.uid()
    OR class_id IN (
      SELECT id FROM classes WHERE homeroom_teacher_id = auth.uid()
    )
  );

-- Kepala_Sekolah: SELECT semua jadwal di sekolahnya
CREATE POLICY "kepsek_schedules_select" ON schedules
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Kepala_Sekolah')
    )
  );

-- Staf_Admin: full access ke jadwal di sekolahnya
CREATE POLICY "admin_schedules_select" ON schedules
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_schedules_insert" ON schedules
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_schedules_update" ON schedules
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_schedules_delete" ON schedules
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );


-- =============================================================================
-- 10. notes
-- =============================================================================
-- notes tidak punya school_id; dikontrol via students.school_id

-- Guru: full access ke catatan yang ia tulis, atau catatan tentang siswa di kelasnya
CREATE POLICY "guru_notes_all" ON notes
  USING (
    author_id = auth.uid()
    OR student_id IN (
      SELECT cs.student_id
      FROM class_students cs
      JOIN classes c ON c.id = cs.class_id
      WHERE c.homeroom_teacher_id = auth.uid()
         OR c.id IN (SELECT class_id FROM schedules WHERE teacher_id = auth.uid())
    )
  );

-- Kepala_Sekolah: SELECT semua catatan siswa di sekolahnya
CREATE POLICY "kepsek_notes_select" ON notes
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Kepala_Sekolah')
    )
  );

-- Staf_Admin: full access ke catatan siswa di sekolahnya
CREATE POLICY "admin_notes_select" ON notes
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_notes_insert" ON notes
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM students
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_notes_update" ON notes
  FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM students
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_notes_delete" ON notes
  FOR DELETE
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );


-- =============================================================================
-- 11. grade_components
-- =============================================================================

-- Guru: full access ke komponen nilai di kelas yang diajarnya
CREATE POLICY "guru_grade_components_all" ON grade_components
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE homeroom_teacher_id = auth.uid()
         OR id IN (SELECT class_id FROM schedules WHERE teacher_id = auth.uid())
    )
  );

-- Kepala_Sekolah: SELECT semua komponen nilai di sekolahnya
CREATE POLICY "kepsek_grade_components_select" ON grade_components
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Kepala_Sekolah')
    )
  );

-- Staf_Admin: full access ke komponen nilai di sekolahnya
CREATE POLICY "admin_grade_components_select" ON grade_components
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_grade_components_insert" ON grade_components
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_grade_components_update" ON grade_components
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );

CREATE POLICY "admin_grade_components_delete" ON grade_components
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                         AND role = 'Staf_Admin')
    )
  );


-- =============================================================================
-- 12. grades
-- =============================================================================
-- grades dikontrol via grade_components.class_id

-- Guru: full access ke nilai siswa di kelas yang diajarnya
CREATE POLICY "guru_grades_all" ON grades
  USING (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE homeroom_teacher_id = auth.uid()
           OR id IN (SELECT class_id FROM schedules WHERE teacher_id = auth.uid())
      )
    )
  );

-- Kepala_Sekolah: SELECT semua nilai di sekolahnya
CREATE POLICY "kepsek_grades_select" ON grades
  FOR SELECT
  USING (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                           AND role = 'Kepala_Sekolah')
      )
    )
  );

-- Staf_Admin: full access ke nilai di sekolahnya
CREATE POLICY "admin_grades_select" ON grades
  FOR SELECT
  USING (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                           AND role = 'Staf_Admin')
      )
    )
  );

CREATE POLICY "admin_grades_insert" ON grades
  FOR INSERT
  WITH CHECK (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                           AND role = 'Staf_Admin')
      )
    )
  );

CREATE POLICY "admin_grades_update" ON grades
  FOR UPDATE
  USING (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                           AND role = 'Staf_Admin')
      )
    )
  )
  WITH CHECK (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                           AND role = 'Staf_Admin')
      )
    )
  );

CREATE POLICY "admin_grades_delete" ON grades
  FOR DELETE
  USING (
    grade_component_id IN (
      SELECT id FROM grade_components
      WHERE class_id IN (
        SELECT id FROM classes
        WHERE school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                           AND role = 'Staf_Admin')
      )
    )
  );


-- =============================================================================
-- 13. grade_scales
-- =============================================================================

-- Guru: SELECT skala nilai di sekolahnya (dibutuhkan untuk kalkulasi rapor)
CREATE POLICY "guru_grade_scales_select" ON grade_scales
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Guru')
  );

-- Kepala_Sekolah: SELECT semua skala nilai di sekolahnya
CREATE POLICY "kepsek_grade_scales_select" ON grade_scales
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Kepala_Sekolah')
  );

-- Staf_Admin: full access ke skala nilai di sekolahnya
CREATE POLICY "admin_grade_scales_select" ON grade_scales
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_grade_scales_insert" ON grade_scales
  FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_grade_scales_update" ON grade_scales
  FOR UPDATE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

CREATE POLICY "admin_grade_scales_delete" ON grade_scales
  FOR DELETE
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()
                 AND role = 'Staf_Admin')
  );

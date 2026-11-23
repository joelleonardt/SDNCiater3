-- =============================================================================
-- Sekolah Admin — Row Level Security (RLS) Policies (Idempoten & Non-Rekursif)
-- =============================================================================
-- Deskripsi : RLS policies untuk tiga peran: Guru, Kepala_Sekolah, Staf_Admin.
--             Aman dijalankan berulang kali (otomatis menghapus policy lama
--             sebelum membuat policy baru) dan bebas infinite recursion karena
--             menggunakan helper SECURITY DEFINER.
--
-- Cara pakai: Jalankan seluruh file ini di Supabase SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Bersihkan seluruh policy lama di 13 tabel agar idempoten
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'schools', 'profiles', 'academic_years', 'semesters', 'classes',
        'students', 'class_students', 'attendance', 'schedules', 'notes',
        'grade_components', 'grades', 'grade_scales', 'daily_journals', 'notifications'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- Helper SECURITY DEFINER functions (mencegah infinite recursion pada RLS
-- tabel profiles serta mutual recursion antara classes dan schedules)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_guru_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = p_class_id
      AND (
        c.homeroom_teacher_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.schedules s
          WHERE s.class_id = c.id
            AND s.teacher_id = (SELECT auth.uid())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT is_active FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_is_active() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_guru_of_class(uuid) TO authenticated, anon, service_role;

-- Pastikan kolom email & requested_role tersedia dan data sekolah default terinisialisasi
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_role text;

CREATE OR REPLACE FUNCTION public.bootstrap_school_and_profile(p_requested_role text DEFAULT NULL)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_has_admin boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role = 'Staf_Admin' AND is_active = true AND school_id IS NOT NULL
  ) INTO v_has_admin;

  IF NOT v_has_admin THEN
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;

    IF v_school_id IS NULL THEN
      INSERT INTO public.schools (id, name, address, principal_name)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'SDN 1 Nusantara',
        'Jl. Pendidikan No. 1, Jakarta Pusat',
        'Drs. Hendra Wijaya, M.Pd.'
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id INTO v_school_id;

      IF v_school_id IS NULL THEN
        SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
      END IF;
    END IF;

    UPDATE public.profiles
    SET
      school_id = COALESCE(school_id, v_school_id),
      role = 'Staf_Admin',
      requested_role = NULL
    WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles
    SET
      requested_role = CASE
        WHEN p_requested_role IN ('Guru', 'Kepala_Sekolah', 'Staf_Admin') AND p_requested_role <> role
          THEN p_requested_role
        ELSE requested_role
      END
    WHERE id = v_user_id;
  END IF;

  RETURN QUERY SELECT * FROM public.profiles WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_school_and_profile(text) TO authenticated, service_role;


-- =============================================================================
-- 1. schools
-- =============================================================================

CREATE POLICY "guru_schools_select" ON schools
  FOR SELECT
  USING (
    id = public.get_my_school_id() AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_schools_select" ON schools
  FOR SELECT
  USING (
    id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_schools_select" ON schools
  FOR SELECT
  USING (
    id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schools_insert" ON schools
  FOR INSERT
  WITH CHECK (
    id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schools_update" ON schools
  FOR UPDATE
  USING (
    id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schools_delete" ON schools
  FOR DELETE
  USING (
    id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 2. profiles
-- =============================================================================

-- Semua pengguna selalu boleh membaca & mengedit profil dirinya sendiri
CREATE POLICY "self_profiles_select" ON profiles
  FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY "self_profiles_update" ON profiles
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = public.get_my_role()
    AND school_id IS NOT DISTINCT FROM public.get_my_school_id()
    AND is_active IS NOT DISTINCT FROM public.get_my_is_active()
  );

-- Guru: SELECT profil rekan di sekolah yang sama
CREATE POLICY "guru_profiles_select" ON profiles
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Guru'
  );

-- Kepala_Sekolah: SELECT semua profil di sekolahnya
CREATE POLICY "kepsek_profiles_select" ON profiles
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah'
  );

-- Staf_Admin: full access ke profil di sekolahnya maupun akun baru (school_id IS NULL) untuk verifikasi
CREATE POLICY "admin_profiles_select" ON profiles
  FOR SELECT
  USING (
    (school_id = public.get_my_school_id() OR school_id IS NULL)
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_profiles_insert" ON profiles
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_profiles_update" ON profiles
  FOR UPDATE
  USING (
    (school_id = public.get_my_school_id() OR school_id IS NULL)
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    (school_id = public.get_my_school_id() OR (school_id IS NULL AND is_active = false))
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_profiles_delete" ON profiles
  FOR DELETE
  USING (
    (school_id = public.get_my_school_id() OR school_id IS NULL)
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 3. academic_years
-- =============================================================================

CREATE POLICY "guru_academic_years_select" ON academic_years
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_academic_years_select" ON academic_years
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_academic_years_select" ON academic_years
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_academic_years_insert" ON academic_years
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_academic_years_update" ON academic_years
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_academic_years_delete" ON academic_years
  FOR DELETE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 4. semesters
-- =============================================================================

CREATE POLICY "guru_semesters_select" ON semesters
  FOR SELECT
  USING (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_semesters_select" ON semesters
  FOR SELECT
  USING (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_semesters_select" ON semesters
  FOR SELECT
  USING (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_semesters_insert" ON semesters
  FOR INSERT
  WITH CHECK (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_semesters_update" ON semesters
  FOR UPDATE
  USING (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_semesters_delete" ON semesters
  FOR DELETE
  USING (
    academic_year_id IN (
      SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 5. classes
-- =============================================================================

CREATE POLICY "guru_classes_select" ON classes
  FOR SELECT
  USING (
    public.is_guru_of_class(id) AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_classes_select" ON classes
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_classes_select" ON classes
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_classes_insert" ON classes
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_classes_update" ON classes
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_classes_delete" ON classes
  FOR DELETE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 6. students
-- =============================================================================

CREATE POLICY "guru_students_select" ON students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.student_id = students.id
        AND public.is_guru_of_class(cs.class_id)
    )
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_students_select" ON students
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_students_select" ON students
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_students_insert" ON students
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_students_update" ON students
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_students_delete" ON students
  FOR DELETE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 7. class_students
-- =============================================================================

CREATE POLICY "guru_class_students_select" ON class_students
  FOR SELECT
  USING (
    public.is_guru_of_class(class_id) AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_class_students_select" ON class_students
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_class_students_select" ON class_students
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_class_students_insert" ON class_students
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_class_students_update" ON class_students
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_class_students_delete" ON class_students
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 8. attendance
-- =============================================================================

CREATE POLICY "guru_attendance_all" ON attendance
  FOR ALL
  USING (
    public.is_guru_of_class(class_id) AND public.get_my_role() = 'Guru'
  )
  WITH CHECK (
    public.is_guru_of_class(class_id) AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_attendance_select" ON attendance
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_attendance_select" ON attendance
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_attendance_insert" ON attendance
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_attendance_update" ON attendance
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_attendance_delete" ON attendance
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 9. schedules
-- =============================================================================

CREATE POLICY "guru_schedules_select" ON schedules
  FOR SELECT
  USING (
    (teacher_id = (SELECT auth.uid()) OR public.is_guru_of_class(class_id))
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_schedules_select" ON schedules
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_schedules_select" ON schedules
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schedules_insert" ON schedules
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schedules_update" ON schedules
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schedules_delete" ON schedules
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 10. notes
-- =============================================================================

CREATE POLICY "guru_notes_select" ON notes
  FOR SELECT
  USING (
    (
      author_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.class_students cs
        WHERE cs.student_id = notes.student_id
          AND public.is_guru_of_class(cs.class_id)
      )
    )
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_notes_insert" ON notes
  FOR INSERT
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
    AND student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
  );

CREATE POLICY "guru_notes_update" ON notes
  FOR UPDATE
  USING (
    author_id = (SELECT auth.uid()) AND public.get_my_role() = 'Guru'
  )
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_notes_delete" ON notes
  FOR DELETE
  USING (
    author_id = (SELECT auth.uid()) AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_notes_select" ON notes
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_notes_select" ON notes
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_notes_insert" ON notes
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_notes_update" ON notes
  FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_notes_delete" ON notes
  FOR DELETE
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 11. grade_components
-- =============================================================================

CREATE POLICY "guru_grade_components_select" ON grade_components
  FOR SELECT
  USING (
    public.is_guru_of_class(class_id) AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_grade_components_select" ON grade_components
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_grade_components_select" ON grade_components
  FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_components_insert" ON grade_components
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_components_update" ON grade_components
  FOR UPDATE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_components_delete" ON grade_components
  FOR DELETE
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 12. grades
-- =============================================================================

CREATE POLICY "guru_grades_all" ON grades
  FOR ALL
  USING (
    grade_component_id IN (
      SELECT id FROM public.grade_components
      WHERE public.is_guru_of_class(class_id)
    )
    AND public.get_my_role() = 'Guru'
  )
  WITH CHECK (
    grade_component_id IN (
      SELECT id FROM public.grade_components
      WHERE public.is_guru_of_class(class_id)
    )
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_grades_select" ON grades
  FOR SELECT
  USING (
    grade_component_id IN (
      SELECT gc.id
      FROM public.grade_components gc
      JOIN public.classes c ON c.id = gc.class_id
      WHERE c.school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_grades_select" ON grades
  FOR SELECT
  USING (
    grade_component_id IN (
      SELECT gc.id
      FROM public.grade_components gc
      JOIN public.classes c ON c.id = gc.class_id
      WHERE c.school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grades_insert" ON grades
  FOR INSERT
  WITH CHECK (
    grade_component_id IN (
      SELECT gc.id
      FROM public.grade_components gc
      JOIN public.classes c ON c.id = gc.class_id
      WHERE c.school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grades_update" ON grades
  FOR UPDATE
  USING (
    grade_component_id IN (
      SELECT gc.id
      FROM public.grade_components gc
      JOIN public.classes c ON c.id = gc.class_id
      WHERE c.school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    grade_component_id IN (
      SELECT gc.id
      FROM public.grade_components gc
      JOIN public.classes c ON c.id = gc.class_id
      WHERE c.school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grades_delete" ON grades
  FOR DELETE
  USING (
    grade_component_id IN (
      SELECT gc.id
      FROM public.grade_components gc
      JOIN public.classes c ON c.id = gc.class_id
      WHERE c.school_id = public.get_my_school_id()
    )
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 13. grade_scales
-- =============================================================================

CREATE POLICY "guru_grade_scales_select" ON grade_scales
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_grade_scales_select" ON grade_scales
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_grade_scales_select" ON grade_scales
  FOR SELECT
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_scales_insert" ON grade_scales
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_scales_update" ON grade_scales
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_scales_delete" ON grade_scales
  FOR DELETE
  USING (
    school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 14. daily_journals
-- =============================================================================

CREATE POLICY "guru_daily_journals_select" ON daily_journals
  FOR SELECT
  USING (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_daily_journals_insert" ON daily_journals
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_daily_journals_update" ON daily_journals
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
  )
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_daily_journals_delete" ON daily_journals
  FOR DELETE
  USING (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND status <> 'Disetujui'
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_daily_journals_select" ON daily_journals
  FOR SELECT
  USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "kepsek_daily_journals_update" ON daily_journals
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Kepala_Sekolah'
  )
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_daily_journals_select" ON daily_journals
  FOR SELECT
  USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Staf_Admin'
  );


-- =============================================================================
-- 15. notifications
-- =============================================================================

CREATE POLICY "recipient_notifications_select" ON notifications
  FOR SELECT
  USING (
    recipient_id = (SELECT auth.uid())
  );

CREATE POLICY "recipient_notifications_update" ON notifications
  FOR UPDATE
  USING (
    recipient_id = (SELECT auth.uid())
  )
  WITH CHECK (
    recipient_id = (SELECT auth.uid())
  );

CREATE POLICY "admin_kepsek_notifications_select" ON notifications
  FOR SELECT
  USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() IN ('Staf_Admin', 'Kepala_Sekolah')
  );

CREATE POLICY "admin_kepsek_notifications_insert" ON notifications
  FOR INSERT
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND sender_id = (SELECT auth.uid())
    AND public.get_my_role() IN ('Staf_Admin', 'Kepala_Sekolah')
  );

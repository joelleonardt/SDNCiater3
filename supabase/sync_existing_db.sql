-- =============================================================================
-- Sekolah Admin — Migrasi Database & Perbaikan RLS Lengkap (Idempoten)
-- =============================================================================
-- Deskripsi : File ini berdiri sendiri (self-contained) untuk database yang SUDAH
--             ada: menambahkan kolom email & requested_role, memperbarui trigger
--             handle_new_user(), fungsi bootstrap_school_and_profile(), helper
--             SECURITY DEFINER, serta mereset seluruh kebijakan RLS pada KE-13 TABEL
--             agar bebas infinite recursion (42P17) pada classes/schedules/profiles.
--
-- Cara pakai: Jalankan seluruh isi file ini di Supabase Dashboard -> SQL Editor.
-- =============================================================================

-- 1. Tambah kolom email & requested_role ke tabel profiles + index + backfill dari auth.users
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS requested_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_length_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_length_check CHECK (char_length(email) <= 254);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- 2. Perbarui constraint status kehadiran agar menerima 'Alpa' maupun 'Alfa'
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alpa', 'Alfa'));

-- 3. Trigger otomatis pembuatan baris profiles saat akun dibuat via UI / Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  target_school_id uuid;
  target_role text;
  req_role text;
  has_admin boolean;
BEGIN
  req_role := NULLIF(new.raw_user_meta_data->>'requested_role', '');
  IF req_role NOT IN ('Guru', 'Kepala_Sekolah', 'Staf_Admin') THEN
    req_role := NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role = 'Staf_Admin'
      AND is_active = true
      AND school_id IS NOT NULL
  ) INTO has_admin;

  -- Bootstrap akun pertama sistem jika belum ada Staf_Admin aktif yang terhubung ke sekolah.
  -- Untuk semua pendaftaran setelahnya, biarkan school_id = NULL dan kunci role = 'Guru'
  -- agar wajib diverifikasi oleh Staf_Admin melalui Dashboard Admin / halaman Pengguna.
  IF NOT has_admin THEN
    SELECT id INTO target_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;

    IF target_school_id IS NULL THEN
      INSERT INTO public.schools (id, name, address, principal_name)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'SDN 1 Nusantara',
        'Jl. Pendidikan No. 1, Jakarta Pusat',
        'Drs. Hendra Wijaya, M.Pd.'
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id INTO target_school_id;

      IF target_school_id IS NULL THEN
        SELECT id INTO target_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
      END IF;
    END IF;

    target_role := 'Staf_Admin';
    req_role := NULL;
  ELSE
    target_school_id := NULL;
    target_role := 'Guru';
    req_role := COALESCE(req_role, 'Guru');
  END IF;

  INSERT INTO public.profiles (id, school_id, full_name, email, role, requested_role, is_active)
  VALUES (
    new.id,
    target_school_id,
    COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Pengguna'),
    new.email,
    target_role,
    req_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id),
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    requested_role = COALESCE(public.profiles.requested_role, EXCLUDED.requested_role);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Pastikan minimal ada 1 sekolah di public.schools dan semua akun auth.users punya baris profiles.
--    Jika sudah ada Staf_Admin aktif, akun baru tanpa profil tetap dibuat berstatus pending (school_id = NULL)
--    dan akun ber-school_id NULL yang sudah ada tetap menunggu verifikasi Staf_Admin.
DO $$
DECLARE
  default_school_id uuid;
  has_admin boolean;
BEGIN
  SELECT id INTO default_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;

  IF default_school_id IS NULL THEN
    INSERT INTO public.schools (id, name, address, principal_name)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      'SDN 1 Nusantara',
      'Jl. Pendidikan No. 1, Jakarta Pusat',
      'Drs. Hendra Wijaya, M.Pd.'
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO default_school_id;

    IF default_school_id IS NULL THEN
      SELECT id INTO default_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role = 'Staf_Admin'
      AND is_active = true
      AND school_id IS NOT NULL
  ) INTO has_admin;

  INSERT INTO public.profiles (id, school_id, full_name, email, role, requested_role, is_active)
  SELECT
    u.id,
    CASE WHEN NOT has_admin THEN default_school_id ELSE NULL END,
    COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1), 'Pengguna'),
    u.email,
    CASE WHEN NOT has_admin THEN 'Staf_Admin' ELSE 'Guru' END,
    CASE
      WHEN NOT has_admin THEN NULL
      WHEN NULLIF(u.raw_user_meta_data->>'requested_role', '') IN ('Guru', 'Kepala_Sekolah', 'Staf_Admin')
        THEN u.raw_user_meta_data->>'requested_role'
      WHEN NULLIF(u.raw_user_meta_data->>'role', '') IN ('Guru', 'Kepala_Sekolah', 'Staf_Admin')
        THEN u.raw_user_meta_data->>'role'
      ELSE 'Guru'
    END,
    true
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

  IF NOT has_admin AND default_school_id IS NOT NULL THEN
    UPDATE public.profiles
    SET school_id = default_school_id, role = 'Staf_Admin', requested_role = NULL
    WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
      AND school_id IS NULL;
  END IF;
END $$;

-- 5. Perbaiki helper SECURITY DEFINER & policy RLS di SELURUH 13 tabel
--    agar error infinite recursion (42P17) pada profiles, classes, schedules,
--    attendance, students, grades, dan laporan langsung hilang sepenuhnya.
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
-- 5.1 schools
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_schools_select" ON public.schools
  FOR SELECT USING (id = public.get_my_school_id() AND public.get_my_role() = 'Guru');

CREATE POLICY "kepsek_schools_select" ON public.schools
  FOR SELECT USING (id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah');

CREATE POLICY "admin_schools_select" ON public.schools
  FOR SELECT USING (id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_schools_insert" ON public.schools
  FOR INSERT WITH CHECK (id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_schools_update" ON public.schools
  FOR UPDATE
  USING (id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin')
  WITH CHECK (id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_schools_delete" ON public.schools
  FOR DELETE USING (id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

-- ---------------------------------------------------------------------------
-- 5.2 profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "self_profiles_select" ON public.profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "self_profiles_update" ON public.profiles
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = public.get_my_role()
    AND school_id IS NOT DISTINCT FROM public.get_my_school_id()
    AND is_active IS NOT DISTINCT FROM public.get_my_is_active()
  );

CREATE POLICY "guru_profiles_select" ON public.profiles
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Guru');

CREATE POLICY "kepsek_profiles_select" ON public.profiles
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah');

CREATE POLICY "admin_profiles_select" ON public.profiles
  FOR SELECT
  USING (
    (school_id = public.get_my_school_id() OR school_id IS NULL)
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_profiles_update" ON public.profiles
  FOR UPDATE
  USING (
    (school_id = public.get_my_school_id() OR school_id IS NULL)
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    (school_id = public.get_my_school_id() OR (school_id IS NULL AND is_active = false))
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_profiles_delete" ON public.profiles
  FOR DELETE
  USING (
    (school_id = public.get_my_school_id() OR school_id IS NULL)
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.3 academic_years
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_academic_years_select" ON public.academic_years
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Guru');

CREATE POLICY "kepsek_academic_years_select" ON public.academic_years
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah');

CREATE POLICY "admin_academic_years_select" ON public.academic_years
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_academic_years_insert" ON public.academic_years
  FOR INSERT WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_academic_years_update" ON public.academic_years
  FOR UPDATE
  USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin')
  WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_academic_years_delete" ON public.academic_years
  FOR DELETE USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

-- ---------------------------------------------------------------------------
-- 5.4 semesters
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_semesters_select" ON public.semesters
  FOR SELECT
  USING (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_semesters_select" ON public.semesters
  FOR SELECT
  USING (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_semesters_select" ON public.semesters
  FOR SELECT
  USING (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_semesters_insert" ON public.semesters
  FOR INSERT
  WITH CHECK (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_semesters_update" ON public.semesters
  FOR UPDATE
  USING (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_semesters_delete" ON public.semesters
  FOR DELETE
  USING (
    academic_year_id IN (SELECT id FROM public.academic_years WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.5 classes (non-rekursif via SECURITY DEFINER is_guru_of_class)
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_classes_select" ON public.classes
  FOR SELECT USING (public.get_my_role() = 'Guru' AND public.is_guru_of_class(id));

CREATE POLICY "kepsek_classes_select" ON public.classes
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah');

CREATE POLICY "admin_classes_select" ON public.classes
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_classes_insert" ON public.classes
  FOR INSERT WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_classes_update" ON public.classes
  FOR UPDATE
  USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin')
  WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_classes_delete" ON public.classes
  FOR DELETE USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

-- ---------------------------------------------------------------------------
-- 5.6 students
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_students_select" ON public.students
  FOR SELECT
  USING (
    public.get_my_role() = 'Guru'
    AND EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.student_id = students.id
        AND public.is_guru_of_class(cs.class_id)
    )
  );

CREATE POLICY "kepsek_students_select" ON public.students
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah');

CREATE POLICY "admin_students_select" ON public.students
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_students_insert" ON public.students
  FOR INSERT WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_students_update" ON public.students
  FOR UPDATE
  USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin')
  WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_students_delete" ON public.students
  FOR DELETE USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

-- ---------------------------------------------------------------------------
-- 5.7 class_students
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_class_students_select" ON public.class_students
  FOR SELECT USING (public.get_my_role() = 'Guru' AND public.is_guru_of_class(class_id));

CREATE POLICY "kepsek_class_students_select" ON public.class_students
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_class_students_select" ON public.class_students
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_class_students_insert" ON public.class_students
  FOR INSERT
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_class_students_update" ON public.class_students
  FOR UPDATE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_class_students_delete" ON public.class_students
  FOR DELETE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.8 attendance
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_attendance_all" ON public.attendance
  FOR ALL
  USING (public.get_my_role() = 'Guru' AND public.is_guru_of_class(class_id))
  WITH CHECK (public.get_my_role() = 'Guru' AND public.is_guru_of_class(class_id));

CREATE POLICY "kepsek_attendance_select" ON public.attendance
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_attendance_select" ON public.attendance
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_attendance_insert" ON public.attendance
  FOR INSERT
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_attendance_update" ON public.attendance
  FOR UPDATE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_attendance_delete" ON public.attendance
  FOR DELETE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.9 schedules (non-rekursif via SECURITY DEFINER is_guru_of_class)
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_schedules_select" ON public.schedules
  FOR SELECT
  USING (
    (teacher_id = (SELECT auth.uid()) OR public.is_guru_of_class(class_id))
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_schedules_select" ON public.schedules
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_schedules_select" ON public.schedules
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schedules_insert" ON public.schedules
  FOR INSERT
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schedules_update" ON public.schedules
  FOR UPDATE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_schedules_delete" ON public.schedules
  FOR DELETE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.10 notes
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_notes_select" ON public.notes
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

CREATE POLICY "guru_notes_insert" ON public.notes
  FOR INSERT
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
    AND student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
  );

CREATE POLICY "guru_notes_update" ON public.notes
  FOR UPDATE
  USING (author_id = (SELECT auth.uid()) AND public.get_my_role() = 'Guru')
  WITH CHECK (author_id = (SELECT auth.uid()) AND public.get_my_role() = 'Guru');

CREATE POLICY "guru_notes_delete" ON public.notes
  FOR DELETE
  USING (author_id = (SELECT auth.uid()) AND public.get_my_role() = 'Guru');

CREATE POLICY "kepsek_notes_select" ON public.notes
  FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_notes_select" ON public.notes
  FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_notes_insert" ON public.notes
  FOR INSERT
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_notes_update" ON public.notes
  FOR UPDATE
  USING (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_notes_delete" ON public.notes
  FOR DELETE
  USING (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.11 grade_components
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_grade_components_select" ON public.grade_components
  FOR SELECT USING (public.get_my_role() = 'Guru' AND public.is_guru_of_class(class_id));

CREATE POLICY "kepsek_grade_components_select" ON public.grade_components
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_grade_components_select" ON public.grade_components
  FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_components_insert" ON public.grade_components
  FOR INSERT
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_components_update" ON public.grade_components
  FOR UPDATE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE POLICY "admin_grade_components_delete" ON public.grade_components
  FOR DELETE
  USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = public.get_my_school_id())
    AND public.get_my_role() = 'Staf_Admin'
  );

-- ---------------------------------------------------------------------------
-- 5.12 grades
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_grades_all" ON public.grades
  FOR ALL
  USING (
    public.get_my_role() = 'Guru'
    AND grade_component_id IN (
      SELECT id FROM public.grade_components WHERE public.is_guru_of_class(class_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'Guru'
    AND grade_component_id IN (
      SELECT id FROM public.grade_components WHERE public.is_guru_of_class(class_id)
    )
  );

CREATE POLICY "kepsek_grades_select" ON public.grades
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

CREATE POLICY "admin_grades_select" ON public.grades
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

CREATE POLICY "admin_grades_insert" ON public.grades
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

CREATE POLICY "admin_grades_update" ON public.grades
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

CREATE POLICY "admin_grades_delete" ON public.grades
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

-- ---------------------------------------------------------------------------
-- 5.13 grade_scales
-- ---------------------------------------------------------------------------
CREATE POLICY "guru_grade_scales_select" ON public.grade_scales
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Guru');

CREATE POLICY "kepsek_grade_scales_select" ON public.grade_scales
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Kepala_Sekolah');

CREATE POLICY "admin_grade_scales_select" ON public.grade_scales
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_grade_scales_insert" ON public.grade_scales
  FOR INSERT WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_grade_scales_update" ON public.grade_scales
  FOR UPDATE
  USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin')
  WITH CHECK (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

CREATE POLICY "admin_grade_scales_delete" ON public.grade_scales
  FOR DELETE USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'Staf_Admin');

-- ---------------------------------------------------------------------------
-- 5.14 daily_journals & 5.15 notifications (Jurnal Harian Guru & Pengingat)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_journals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id     uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  journal_date date NOT NULL,
  subject      text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 100),
  topic        text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 255),
  activities   text NOT NULL CHECK (char_length(activities) BETWEEN 1 AND 2000),
  status       text NOT NULL DEFAULT 'Menunggu_Tinjauan'
                 CHECK (status IN ('Menunggu_Tinjauan','Disetujui','Ditolak')),
  reviewer_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes text CHECK (review_notes IS NULL OR char_length(review_notes) <= 1000),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_journals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_daily_journals_school_date  ON public.daily_journals (school_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_journals_teacher_date ON public.daily_journals (teacher_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_journals_class_id     ON public.daily_journals (class_id);
CREATE INDEX IF NOT EXISTS idx_daily_journals_status       ON public.daily_journals (status);

CREATE POLICY "guru_daily_journals_select" ON public.daily_journals
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_daily_journals_insert" ON public.daily_journals
  FOR INSERT WITH CHECK (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "guru_daily_journals_update" ON public.daily_journals
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

CREATE POLICY "guru_daily_journals_delete" ON public.daily_journals
  FOR DELETE USING (
    school_id = public.get_my_school_id()
    AND teacher_id = (SELECT auth.uid())
    AND status <> 'Disetujui'
    AND public.get_my_role() = 'Guru'
  );

CREATE POLICY "kepsek_daily_journals_select" ON public.daily_journals
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "kepsek_daily_journals_update" ON public.daily_journals
  FOR UPDATE
  USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Kepala_Sekolah'
  )
  WITH CHECK (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Kepala_Sekolah'
  );

CREATE POLICY "admin_daily_journals_select" ON public.daily_journals
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() = 'Staf_Admin'
  );

CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type         text NOT NULL CHECK (type IN ('Pengingat_Jurnal','Tinjauan_Jurnal')),
  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  message      text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  target_date  date,
  journal_id   uuid REFERENCES public.daily_journals(id) ON DELETE SET NULL,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_school_date      ON public.notifications (school_id, created_at DESC);

CREATE POLICY "recipient_notifications_select" ON public.notifications
  FOR SELECT USING (recipient_id = (SELECT auth.uid()));

CREATE POLICY "recipient_notifications_update" ON public.notifications
  FOR UPDATE
  USING (recipient_id = (SELECT auth.uid()))
  WITH CHECK (recipient_id = (SELECT auth.uid()));

CREATE POLICY "admin_kepsek_notifications_select" ON public.notifications
  FOR SELECT USING (
    school_id = public.get_my_school_id()
    AND public.get_my_role() IN ('Staf_Admin', 'Kepala_Sekolah')
  );

CREATE POLICY "admin_kepsek_notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    school_id = public.get_my_school_id()
    AND sender_id = (SELECT auth.uid())
    AND public.get_my_role() IN ('Staf_Admin', 'Kepala_Sekolah')
  );

-- ---------------------------------------------------------------------------
-- 6. Pembuatan & Registrasi Akun Tanpa Kirim Email (Anti Email Rate Limit)
--    Semua verifikasi akun baru dilakukan melalui Dashboard Admin, bukan email.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Backfill akun lama yang mungkin tertahan karena email_confirmed_at masih NULL
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, '')
WHERE email_confirmed_at IS NULL;

-- Trigger BEFORE INSERT pada auth.users agar setiap pendaftaran otomatis email_confirmed_at = now()
CREATE OR REPLACE FUNCTION public.auto_confirm_auth_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || '{"email_verified": true}'::jsonb;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_auth_user_email();

-- RPC untuk Staf_Admin: Tambah Pengguna langsung aktif tanpa memicu pengiriman email Supabase
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_school_id uuid
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
  v_user_id uuid := gen_random_uuid();
  v_instance_id uuid;
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL OR public.get_my_role() <> 'Staf_Admin' THEN
    RAISE EXCEPTION 'Hanya Staf Admin yang dapat menambahkan pengguna secara langsung.';
  END IF;

  IF p_role NOT IN ('Guru', 'Kepala_Sekolah', 'Staf_Admin') THEN
    RAISE EXCEPTION 'Peran tidak valid.';
  END IF;

  IF char_length(p_password) < 8 THEN
    RAISE EXCEPTION 'Kata sandi minimal 8 karakter.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Email sudah terdaftar oleh pengguna lain.';
  END IF;

  SELECT COALESCE(
    (SELECT instance_id FROM auth.users LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO v_instance_id;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  )
  VALUES (
    v_instance_id,
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'full_name', v_name,
      'role', p_role,
      'email_verified', true,
      'phone_verified', false
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, school_id, full_name, email, role, requested_role, is_active)
  VALUES (v_user_id, p_school_id, v_name, v_email, p_role, NULL, true)
  ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    requested_role = NULL,
    is_active = true
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid) TO authenticated, service_role;

-- RPC untuk Registrasi Mandiri di Halaman Login tanpa mengirim email (verifikasi via Dashboard Admin)
CREATE OR REPLACE FUNCTION public.register_user_no_email(
  p_email text,
  p_password text,
  p_full_name text,
  p_requested_role text DEFAULT 'Guru'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
  v_req_role text := COALESCE(NULLIF(trim(p_requested_role), ''), 'Guru');
  v_user_id uuid := gen_random_uuid();
  v_instance_id uuid;
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Format email tidak valid.';
  END IF;

  IF char_length(p_password) < 8 THEN
    RAISE EXCEPTION 'Kata sandi minimal 8 karakter.';
  END IF;

  IF v_req_role NOT IN ('Guru', 'Kepala_Sekolah', 'Staf_Admin') THEN
    v_req_role := 'Guru';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.';
  END IF;

  SELECT COALESCE(
    (SELECT instance_id FROM auth.users LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO v_instance_id;

  -- Trigger on_auth_user_created (public.handle_new_user) akan otomatis membuat baris public.profiles
  -- dengan status menunggu verifikasi Staf Admin di Dashboard Admin (school_id = NULL).
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  )
  VALUES (
    v_instance_id,
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'full_name', v_name,
      'role', 'Guru',
      'requested_role', v_req_role,
      'email_verified', true,
      'phone_verified', false
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user_no_email(text, text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Perbaikan Foreign Key agar Delete User di Supabase Auth Tidak Error
--    ("Failed to delete selected users: Database error deleting user")
-- ---------------------------------------------------------------------------

-- Pastikan profiles.id memiliki ON DELETE CASCADE ke auth.users(id)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Pastikan classes.homeroom_teacher_id otomatis menjadi NULL saat akun guru dihapus
ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_homeroom_teacher_id_fkey;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_homeroom_teacher_id_fkey
  FOREIGN KEY (homeroom_teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Pastikan schedules.teacher_id otomatis terhapus (CASCADE) saat akun guru dihapus
ALTER TABLE public.schedules
  DROP CONSTRAINT IF EXISTS schedules_teacher_id_fkey;
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Pastikan notes.author_id otomatis terhapus (CASCADE) saat akun pembuat catatan dihapus
ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_author_id_fkey;
ALTER TABLE public.notes
  ADD CONSTRAINT notes_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

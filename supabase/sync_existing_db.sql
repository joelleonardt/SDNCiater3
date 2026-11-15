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
        'grade_components', 'grades', 'grade_scales'
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

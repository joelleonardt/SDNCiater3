-- =============================================================================
-- Sekolah Admin — Seed Data (Development)
-- =============================================================================
-- Deskripsi : Data awal untuk keperluan development dan testing lokal.
--             Menggunakan UUID tetap (fixed) agar referential integrity
--             terjaga dan data dapat di-seed ulang secara idempoten.
--
-- Cara pakai : Jalankan file ini di Supabase SQL Editor SETELAH menjalankan
--              schema.sql.
--
-- CATATAN PENTING — Profiles / Users:
--   Tabel `profiles` membutuhkan referensi ke `auth.users` (Supabase Auth).
--   Data pengguna (Guru, Kepala_Sekolah, Staf_Admin) TIDAK dapat di-seed
--   di sini karena pembuatan user Auth harus melalui Supabase Auth API atau
--   Dashboard (Authentication > Users). Buat user secara manual di dashboard
--   Supabase, lalu profil akan terbuat otomatis via trigger atau dapat
--   dimasukkan manual dengan menggunakan UUID dari auth.users.
--
-- KEAMANAN:
--   File ini TIDAK mengandung Supabase project URL maupun anon/service key.
--   Simpan credential tersebut HANYA di file `.env` (tidak di-commit ke repo).
--
-- Isi seed:
--   - 1  sekolah
--   - 1  tahun ajaran (2025/2026, aktif)
--   - 2  semester (Ganjil dan Genap)
--   - 3  kelas (Kelas 1A, Kelas 2B, Kelas 3C)
--   - 10 siswa dengan data realistis Indonesia
--   - 10 pendaftaran kelas (class_students)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- UUID Constants (fixed untuk idempotency)
-- ---------------------------------------------------------------------------
-- School        : '11111111-0000-0000-0000-000000000001'
-- Academic Year : '22222222-0000-0000-0000-000000000001'
-- Semester Ganjil: '33333333-0000-0000-0000-000000000001'
-- Semester Genap : '33333333-0000-0000-0000-000000000002'
-- Kelas 1A      : '44444444-0000-0000-0000-000000000001'
-- Kelas 2B      : '44444444-0000-0000-0000-000000000002'
-- Kelas 3C      : '44444444-0000-0000-0000-000000000003'
-- Siswa 1–10    : '55555555-0000-0000-0000-00000000000{1..a}'


-- ---------------------------------------------------------------------------
-- 1. schools
-- ---------------------------------------------------------------------------
INSERT INTO schools (id, name, address, principal_name)
VALUES (
  '11111111-0000-0000-0000-000000000001',
  'SD Negeri Merdeka 01',
  'Jl. Pahlawan No. 12, Kelurahan Sukamaju, Kecamatan Cibiru, Kota Bandung, Jawa Barat 40614',
  'Bapak Drs. Hendra Kusuma, M.Pd.'
)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. academic_years
-- ---------------------------------------------------------------------------
INSERT INTO academic_years (id, school_id, name, is_active)
VALUES (
  '22222222-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  '2025/2026',
  true
)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3. semesters
-- ---------------------------------------------------------------------------
INSERT INTO semesters (id, academic_year_id, name)
VALUES
  (
    '33333333-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000001',
    'Ganjil'
  ),
  (
    '33333333-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000001',
    'Genap'
  )
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. classes
--    homeroom_teacher_id dibiarkan NULL karena data profiles/users
--    harus dibuat terlebih dahulu melalui Supabase Auth.
--    Update kolom ini setelah membuat akun Guru di Supabase Dashboard.
-- ---------------------------------------------------------------------------
INSERT INTO classes (id, school_id, academic_year_id, name, grade_level, homeroom_teacher_id)
VALUES
  (
    '44444444-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000001',
    'Kelas 1A',
    1,
    NULL  -- Isi dengan UUID guru setelah akun dibuat di Supabase Auth
  ),
  (
    '44444444-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000001',
    'Kelas 2B',
    2,
    NULL  -- Isi dengan UUID guru setelah akun dibuat di Supabase Auth
  ),
  (
    '44444444-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000001',
    'Kelas 3C',
    3,
    NULL  -- Isi dengan UUID guru setelah akun dibuat di Supabase Auth
  )
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 5. students (10 siswa dengan nama dan data Indonesia yang realistis)
-- ---------------------------------------------------------------------------
INSERT INTO students (id, school_id, full_name, nis, gender, date_of_birth, parent_name, parent_contact)
VALUES
  -- Kelas 1A (4 siswa)
  (
    '55555555-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'Anisa Putri Rahayu',
    '202501001',
    'Perempuan',
    '2019-03-14',
    'Ibu Siti Rahayu',
    '08121234001'
  ),
  (
    '55555555-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000001',
    'Budi Santoso',
    '202501002',
    'Laki-laki',
    '2019-07-22',
    'Bapak Agus Santoso',
    '08121234002'
  ),
  (
    '55555555-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000001',
    'Citra Dewi Lestari',
    '202501003',
    'Perempuan',
    '2019-11-05',
    'Ibu Dewi Lestari',
    '08121234003'
  ),
  (
    '55555555-0000-0000-0000-000000000004',
    '11111111-0000-0000-0000-000000000001',
    'Deni Firmansyah',
    '202501004',
    'Laki-laki',
    '2019-01-30',
    'Bapak Firman Hidayat',
    '08121234004'
  ),
  -- Kelas 2B (3 siswa)
  (
    '55555555-0000-0000-0000-000000000005',
    '11111111-0000-0000-0000-000000000001',
    'Elisa Nur Fadilah',
    '202401005',
    'Perempuan',
    '2018-05-18',
    'Ibu Nurul Fadilah',
    '08121234005'
  ),
  (
    '55555555-0000-0000-0000-000000000006',
    '11111111-0000-0000-0000-000000000001',
    'Fajar Ramadhan',
    '202401006',
    'Laki-laki',
    '2018-09-10',
    'Bapak Ramadhan Putra',
    '08121234006'
  ),
  (
    '55555555-0000-0000-0000-000000000007',
    '11111111-0000-0000-0000-000000000001',
    'Gita Permata Sari',
    '202401007',
    'Perempuan',
    '2018-02-27',
    'Ibu Permata Indah',
    '08121234007'
  ),
  -- Kelas 3C (3 siswa)
  (
    '55555555-0000-0000-0000-000000000008',
    '11111111-0000-0000-0000-000000000001',
    'Hendra Wijaya',
    '202301008',
    'Laki-laki',
    '2017-08-03',
    'Bapak Wahyu Wijaya',
    '08121234008'
  ),
  (
    '55555555-0000-0000-0000-000000000009',
    '11111111-0000-0000-0000-000000000001',
    'Indah Kusuma Wardani',
    '202301009',
    'Perempuan',
    '2017-12-15',
    'Ibu Kusuma Ayu',
    '08121234009'
  ),
  (
    '55555555-0000-0000-0000-000000000010',
    '11111111-0000-0000-0000-000000000001',
    'Joko Prasetyo',
    '202301010',
    'Laki-laki',
    '2017-04-21',
    'Bapak Prasetyo Budi',
    '08121234010'
  )
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 6. class_students (daftarkan setiap siswa ke kelasnya)
-- ---------------------------------------------------------------------------
INSERT INTO class_students (class_id, student_id)
VALUES
  -- Kelas 1A
  ('44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001'),
  ('44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002'),
  ('44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000003'),
  ('44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000004'),
  -- Kelas 2B
  ('44444444-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000005'),
  ('44444444-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000006'),
  ('44444444-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000007'),
  -- Kelas 3C
  ('44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000008'),
  ('44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000009'),
  ('44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000010')
ON CONFLICT (class_id, student_id) DO NOTHING;


-- =============================================================================
-- Selesai. Data seed berhasil dimasukkan.
--
-- Langkah selanjutnya:
-- 1. Buat akun pengguna (Guru, Kepala_Sekolah, Staf_Admin) melalui:
--    Supabase Dashboard > Authentication > Users > Invite User
-- 2. Setelah akun terbuat, masukkan data profil ke tabel `profiles`
--    menggunakan UUID dari auth.users.
-- 3. Update kolom homeroom_teacher_id di tabel `classes` dengan UUID
--    guru yang sesuai.
-- 4. Konfigurasikan `.env` dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
--    dari Supabase Dashboard > Project Settings > API.
-- =============================================================================

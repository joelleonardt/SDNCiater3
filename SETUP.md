# Panduan Setup Sekolah Admin

Panduan ini menjelaskan langkah-langkah untuk menyiapkan lingkungan pengembangan aplikasi **Sekolah Admin** dari awal.

---

## Prasyarat

- Node.js versi 18 atau lebih baru
- npm versi 9 atau lebih baru
- Akun [Supabase](https://supabase.com) (gratis)
- Git

---

## Langkah 1 — Buat Supabase Project

1. Buka [https://supabase.com](https://supabase.com) dan masuk ke akun Anda.
2. Klik **New project**.
3. Isi nama project (contoh: `sekolah-admin`), pilih region terdekat (misal: Southeast Asia), dan buat database password yang kuat.
4. Klik **Create new project** dan tunggu hingga project selesai dibuat (sekitar 1–2 menit).
5. Setelah project siap, buka menu **Project Settings → API**.
6. Catat dua nilai berikut — Anda akan membutuhkannya di Langkah 4:
   - **Project URL** (contoh: `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (di bawah bagian "Project API keys")

---

## Langkah 2 — Jalankan Schema SQL

Schema ini membuat semua 13 tabel database beserta foreign key constraints dan mengaktifkan Row Level Security (RLS).

1. Di dashboard Supabase, buka menu **SQL Editor**.
2. Klik **New query**.
3. Salin seluruh isi file `supabase/schema.sql` dari repository ini, tempelkan ke editor, lalu klik **Run** (atau tekan `Ctrl+Enter` / `Cmd+Enter`).
4. Pastikan tidak ada pesan error di bagian bawah. Jika berhasil, Anda akan melihat konfirmasi `Success. No rows returned`.

---

## Langkah 3 — Jalankan RLS Policies SQL

File ini menambahkan Row Level Security policies untuk ketiga peran pengguna (Guru, Kepala_Sekolah, Staf_Admin).

1. Masih di **SQL Editor**, buat query baru.
2. Salin seluruh isi file `supabase/rls_policies.sql`, tempelkan, lalu klik **Run**.
3. Pastikan tidak ada pesan error.

---

## Langkah 4 — Jalankan Seed SQL

File seed menyediakan data awal untuk keperluan pengembangan dan pengujian (1 sekolah, 1 tahun ajaran, 2 semester, 3 kelas, 10 siswa).

1. Masih di **SQL Editor**, buat query baru.
2. Salin seluruh isi file `supabase/seed.sql`, tempelkan, lalu klik **Run**.
3. Pastikan tidak ada pesan error.

> **Catatan:** Jalankan seed SQL hanya sekali. Menjalankannya lebih dari sekali dapat menyebabkan error duplikat data.

---

## Langkah 5 — Konfigurasi File `.env`

Variabel lingkungan menyimpan kredensial Supabase dan **tidak boleh** di-commit ke repository.

1. Di root folder repository, salin file contoh:
   ```bash
   cp .env.example .env
   ```
   Di Windows (PowerShell):
   ```powershell
   Copy-Item .env.example .env
   ```

2. Buka file `.env` dengan editor teks, lalu isi nilai yang telah Anda catat di Langkah 1:
   ```env
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Simpan file. Pastikan `.env` sudah masuk dalam daftar `.gitignore` — **jangan pernah commit file ini**.

---

## Langkah 6 — Install Dependencies dan Jalankan Aplikasi

1. Install semua dependencies:
   ```bash
   npm install
   ```

2. Jalankan development server:
   ```bash
   npm run dev
   ```

3. Buka browser dan akses `http://localhost:5173`.

4. Login menggunakan akun yang telah dibuat di Supabase Auth, atau gunakan akun dari data seed jika tersedia.

---

## Catatan Tambahan

- File `.env` **tidak boleh** di-commit ke version control. File `.env.example` yang berisi placeholder (tanpa nilai) boleh di-commit sebagai referensi.
- Untuk menjalankan tests: `npm run test`
- Untuk build production: `npm run build`
- Jika ada perubahan schema database, jalankan ulang `supabase/schema.sql` dan `supabase/rls_policies.sql` di SQL Editor.

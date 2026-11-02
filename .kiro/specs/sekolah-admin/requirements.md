# Requirements Document

## Introduction

Sekolah Admin adalah aplikasi web administrasi sekolah untuk Sekolah Dasar (SD) di Indonesia. Aplikasi ini membantu guru, kepala sekolah, dan staf administrasi dalam mengelola data siswa, kehadiran, jadwal mengajar, nilai, dan laporan — semuanya dalam satu platform yang mudah digunakan. Antarmuka seluruhnya dalam Bahasa Indonesia, dirancang agar guru senior yang kurang familiar dengan teknologi sekalipun dapat menggunakannya dengan nyaman.

Aplikasi dibangun di atas stack React + Vite (frontend), Tailwind CSS + shadcn/ui (styling), React Router (navigasi), Zustand atau React Context (state global), dan Supabase (database PostgreSQL, Auth, Storage). Semua komunikasi data melewati Supabase JS client; tidak ada backend tambahan.

## Glossary

- **Sekolah_Admin**: Aplikasi web administrasi sekolah yang menjadi subjek dokumen ini.
- **Guru**: Pengguna dengan peran pengajar; dapat mengelola kehadiran, nilai, dan catatan siswa di kelas yang diampu.
- **Kepala_Sekolah**: Pengguna dengan peran kepala sekolah; memiliki akses baca penuh ke seluruh data dan dapat mengelola akun pengguna.
- **Staf_Admin**: Pengguna dengan peran administrasi tertinggi; dapat membuat akun pengguna baru, mengelola data master sekolah, dan mengakses semua fitur.
- **Siswa**: Peserta didik yang terdaftar di sekolah; bukan pengguna sistem.
- **Kelas**: Kelompok belajar dalam satu tahun ajaran (contoh: Kelas 1A, Kelas 6B).
- **Tahun_Ajaran**: Rentang waktu satu tahun akademik (contoh: 2025/2026).
- **Semester**: Bagian dari Tahun_Ajaran; bernilai Ganjil atau Genap.
- **Kehadiran**: Catatan status hadir/tidak hadir Siswa pada hari tertentu (Hadir, Sakit, Izin, Alpa).
- **Jadwal**: Jadwal mengajar mingguan per Kelas dan mata pelajaran.
- **Catatan_Siswa**: Catatan perilaku atau prestasi yang ditulis oleh Guru untuk Siswa tertentu.
- **Komponen_Nilai**: Elemen penyusun nilai akhir (contoh: Tugas, UTS, UAS) dengan bobot persentase.
- **Nilai**: Skor yang diperoleh Siswa untuk setiap Komponen_Nilai dalam satu Semester.
- **Skala_Nilai**: Rentang angka yang dipetakan ke huruf nilai (A, B, C, D).
- **Laporan**: Dokumen yang dapat dicetak atau diekspor, berisi rekap kehadiran atau rapor siswa.
- **RLS**: Row Level Security — fitur Supabase/PostgreSQL yang membatasi akses data berdasarkan identitas pengguna.
- **CSV**: Comma-Separated Values — format file teks untuk impor data massal.
- **Supabase**: Platform backend-as-a-service yang menyediakan PostgreSQL, Auth, dan Storage.

---

## Requirements

### Requirement 1: Database Schema dan Setup

**User Story:** Sebagai Staf_Admin, saya ingin database dengan skema lengkap dan RLS aktif, sehingga semua data sekolah tersimpan dengan aman dan terstruktur sejak awal.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL provide a SQL schema file that creates the following tables: `profiles`, `schools`, `academic_years`, `semesters`, `classes`, `students`, `class_students`, `attendance`, `schedules`, `notes`, `grade_components`, `grades`, and `grade_scales`.
2. THE Sekolah_Admin SHALL define foreign key constraints between all related tables to enforce referential integrity.
3. THE Sekolah_Admin SHALL enable Row Level Security (RLS) on every table in the database.
4. THE Sekolah_Admin SHALL provide RLS policies that grant Guru SELECT, INSERT, UPDATE, and DELETE access only to rows in the `classes`, `class_students`, `attendance`, `schedules`, `notes`, `grade_components`, and `grades` tables that are associated with classes the authenticated Guru teaches, and no access to rows in those tables associated with other Guru's classes.
5. THE Sekolah_Admin SHALL provide RLS policies that grant Kepala_Sekolah SELECT access to all rows across all tables where the row's associated `school_id` matches the Kepala_Sekolah's own `school_id`.
6. THE Sekolah_Admin SHALL provide RLS policies that grant Staf_Admin SELECT, INSERT, UPDATE, and DELETE access to all rows across all tables where the row's associated `school_id` matches the Staf_Admin's own `school_id`.
7. THE Sekolah_Admin SHALL provide a seed SQL file containing at least one school record, one Tahun_Ajaran, two Semester records, three Kelas records, and ten Siswa records for development and testing purposes.
8. THE Sekolah_Admin SHALL store the Supabase project URL and anon key exclusively in a `.env` file and MUST NOT include these values in any committed project file, including source code, configuration files, migration files, and seed files.
9. THE Sekolah_Admin SHALL provide a setup instruction document that covers, at minimum, the following steps in order: Supabase project creation, SQL schema file execution, seed file execution, and `.env` file configuration with the required variable names.

---

### Requirement 2: Autentikasi dan Manajemen Akun

**User Story:** Sebagai pengguna, saya ingin dapat masuk dan keluar dengan aman menggunakan email dan kata sandi, sehingga data sekolah terlindungi dari akses tidak sah.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL provide a login page where users authenticate using email and password via Supabase Auth.
2. WHEN a user submits incorrect credentials, THE Sekolah_Admin SHALL display an error message in Bahasa Indonesia within 3 seconds.
3. WHEN a user submits the "Lupa Kata Sandi" form with a registered email address, THE Sekolah_Admin SHALL send a password-reset email via Supabase Auth within 5 seconds.
4. WHEN a user submits the password-reset form with a new password of at least 8 characters, THE Sekolah_Admin SHALL update the password via Supabase Auth and redirect the user to the login page.
5. IF a user attempts to access a non-authentication route without an active session, THEN THE Sekolah_Admin SHALL redirect the user to the login page.
6. WHEN an authenticated user navigates to the login page, THE Sekolah_Admin SHALL redirect the user to the Dashboard.
7. WHEN a user successfully logs in, THE Sekolah_Admin SHALL store the authenticated user's role and profile in global state.
8. IF a user's session expires, THEN THE Sekolah_Admin SHALL redirect the user to the login page and display a session-expired message in Bahasa Indonesia.
9. THE Sekolah_Admin SHALL restrict user account creation to Staf_Admin only; self-registration MUST NOT be available.
10. WHEN Staf_Admin creates a new user account, THE Sekolah_Admin SHALL require email, full name, and role (Guru, Kepala_Sekolah, or Staf_Admin) as mandatory fields and display a success confirmation in Bahasa Indonesia upon account creation.
11. IF a user clicks an expired or already-used password-reset link, THEN THE Sekolah_Admin SHALL display an error message in Bahasa Indonesia indicating the link is no longer valid and provide a link to request a new password-reset email.

---

### Requirement 3: Layout dan Navigasi

**User Story:** Sebagai pengguna, saya ingin antarmuka dengan menu navigasi yang jelas dan responsif, sehingga saya dapat berpindah halaman dengan mudah di perangkat apapun.

#### Acceptance Criteria

1. WHILE the viewport width is ≥1024px, THE Sekolah_Admin SHALL display a collapsible sidebar containing the main navigation menu with text labels on every menu item, defaulting to an expanded state.
2. WHEN a user clicks the hamburger icon on a mobile screen (<1024px width), THE Sekolah_Admin SHALL display the navigation menu as a drawer overlay, and SHALL close the drawer when the user taps outside the drawer or selects a navigation item.
3. THE Sekolah_Admin SHALL display a top bar on every authenticated page containing the application logo, a global search field, a notifications icon, and a user profile menu.
4. WHEN a user clicks the profile menu in the top bar, THE Sekolah_Admin SHALL display options for "Profil Saya" and "Keluar".
5. WHEN a user navigates to a page, THE Sekolah_Admin SHALL apply a background fill or left-border highlight to the corresponding sidebar menu item and remove the highlight from all other menu items.
6. THE Sekolah_Admin SHALL render navigation menu items conditionally based on the user's role, hiding items the role is not permitted to access.
7. IF a user attempts to navigate directly to a route they are not permitted to access based on their role, THEN THE Sekolah_Admin SHALL redirect the user to a 403 error page without displaying any restricted content.
8. THE Sekolah_Admin SHALL use React Router for all client-side navigation without full page reloads.

---

### Requirement 4: Dashboard

**User Story:** Sebagai pengguna, saya ingin halaman ringkasan yang menampilkan informasi penting hari ini, sehingga saya dapat memulai hari dengan gambaran situasi sekolah secara cepat.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL display summary cards on the Dashboard showing total number of active Siswa, total number of Kelas, and today's attendance percentage calculated as (total Hadir ÷ total active Siswa) × 100, rounded to one decimal place.
2. THE Sekolah_Admin SHALL display a "Jadwal Hari Ini" section on the Dashboard showing the authenticated user's scheduled classes for the current day, including subject name, time slot, and class name for each entry; IF the authenticated user has the Staf_Admin role, THEN THE Sekolah_Admin SHALL display all classes scheduled for the current day regardless of assigned teacher.
3. THE Sekolah_Admin SHALL display an announcements section on the Dashboard showing the 5 most recent announcements ordered by creation date descending.
4. THE Sekolah_Admin SHALL display a weekly attendance chart on the Dashboard showing the daily attendance rate for each day of the current Monday-to-Sunday calendar week, calculated using the same formula as the summary card in criterion 1.
5. WHEN Dashboard data is loading, THE Sekolah_Admin SHALL display skeleton placeholders for each card and chart.
6. IF no data is available for a Dashboard section, THEN THE Sekolah_Admin SHALL display an empty-state message in Bahasa Indonesia specific to that section indicating no data is available.

---

### Requirement 5: Data Kelas

**User Story:** Sebagai Staf_Admin, saya ingin mengelola daftar kelas, sehingga guru dapat dikaitkan ke kelas yang tepat dan data siswa terorganisir dengan benar.

#### Acceptance Criteria

1. WHILE an active Tahun_Ajaran is available, THE Sekolah_Admin SHALL display a list of all Kelas for that Tahun_Ajaran, showing class name, grade level, homeroom teacher name, and number of enrolled students. IF no active Tahun_Ajaran exists, THEN THE Sekolah_Admin SHALL display an empty state message indicating no active academic year is configured.
2. WHEN Staf_Admin clicks "Tambah Kelas", THE Sekolah_Admin SHALL open a modal form requiring class name (1–50 characters) and grade level (a positive integer between 1 and 12), and optionally a homeroom teacher selected from the list of active Guru.
3. WHEN Staf_Admin submits a valid add-class form, THE Sekolah_Admin SHALL save the new Kelas to the database and update the Kelas list without a full page reload. IF the submitted class name already exists within the active Tahun_Ajaran, THEN THE Sekolah_Admin SHALL reject the submission and display an inline error message in Bahasa Indonesia indicating the class name must be unique.
4. WHEN Staf_Admin clicks the edit icon on a Kelas row, THE Sekolah_Admin SHALL open a pre-filled modal form allowing the Staf_Admin to update the class name, grade level, and homeroom teacher for that Kelas.
5. WHEN Staf_Admin clicks the delete icon on a Kelas row, THE Sekolah_Admin SHALL display a confirmation dialog before permanently deleting the Kelas.
6. IF a delete action is confirmed, THEN THE Sekolah_Admin SHALL remove the Kelas record and all associated class-student enrollments from the database.
7. IF a delete operation fails, THEN THE Sekolah_Admin SHALL display an error message in Bahasa Indonesia indicating the deletion was unsuccessful and retain the Kelas record unchanged.
8. IF a form field fails validation, THEN THE Sekolah_Admin SHALL display an inline error message in Bahasa Indonesia next to the relevant field.

---

### Requirement 6: Data Siswa

**User Story:** Sebagai Staf_Admin atau Guru, saya ingin mengelola data lengkap setiap siswa, sehingga semua informasi siswa tersedia dan dapat diperbarui kapan pun dibutuhkan.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL display a searchable, filterable, paginated table of all Siswa, showing full name, NIS (Nomor Induk Siswa), enrolled class, and gender.
2. WHEN a user types in the search field, THE Sekolah_Admin SHALL filter the Siswa list to show only records where the full name, NIS, or enrolled class contains the search term, within 300ms.
3. THE Sekolah_Admin SHALL paginate the Siswa table with a configurable page size of 10, 25, or 50 rows per page.
4. WHEN Staf_Admin clicks "Tambah Siswa", THE Sekolah_Admin SHALL open a form requiring full name, NIS, gender, date of birth, and optionally a parent/guardian name and contact number.
5. WHEN a user clicks a student's name in the table, THE Sekolah_Admin SHALL navigate to a Student Detail page showing all student data, attendance summary, and the 5 most recent notes.
6. WHEN Staf_Admin clicks "Edit" on a Siswa record and submits valid changes, THE Sekolah_Admin SHALL save the updated data and display a success confirmation message in Bahasa Indonesia.
7. WHEN Staf_Admin confirms deletion of a Siswa record, THE Sekolah_Admin SHALL soft-delete the Siswa record and all directly associated attendance and grade records, making them inaccessible through the normal interface while preserving them in the data store.
8. WHEN Staf_Admin clicks "Impor CSV", THE Sekolah_Admin SHALL display a CSV import interface; the initial release MAY use a placeholder dialog indicating the feature is coming soon.
9. IF a required student form field is empty on submission, THEN THE Sekolah_Admin SHALL display a validation error in Bahasa Indonesia and prevent form submission.
10. IF the NIS entered in the student form already exists in the system, THEN THE Sekolah_Admin SHALL display a duplicate NIS error message in Bahasa Indonesia and prevent form submission.

---

### Requirement 7: Kehadiran

**User Story:** Sebagai Guru, saya ingin mencatat dan melihat rekap kehadiran siswa per kelas dan tanggal, sehingga data kehadiran selalu akurat dan mudah dilaporkan.

#### Acceptance Criteria

1. WHEN a Guru selects a Kelas and a date on the attendance entry page, THE Sekolah_Admin SHALL load the attendance form for that Kelas and date combination.
2. WHEN a Guru opens the attendance entry page for a Kelas and date, THE Sekolah_Admin SHALL display a list of all enrolled Siswa with a status selector per student showing options: Hadir, Sakit, Izin, Alpa.
3. IF the selected Kelas has no enrolled Siswa, THEN THE Sekolah_Admin SHALL display a message indicating that no students are enrolled in the selected class.
4. WHEN a Guru activates the "Tandai Semua Hadir" button on the attendance entry page, THE Sekolah_Admin SHALL set all displayed student statuses to Hadir in a single action.
5. WHEN a Guru submits attendance, THE Sekolah_Admin SHALL save all statuses and display a success toast notification in Bahasa Indonesia that remains visible for at least 3 seconds.
6. IF attendance submission fails, THEN THE Sekolah_Admin SHALL display an error notification in Bahasa Indonesia and preserve all entered statuses without clearing the form.
7. WHEN a Guru opens an attendance record that has already been submitted for a given class and date, THE Sekolah_Admin SHALL pre-fill the form with the existing statuses to allow corrections.
8. WHEN a Guru requests the attendance recap for a Kelas and a date range of 1 to 31 days, THE Sekolah_Admin SHALL display each enrolled student's total day count per status (Hadir, Sakit, Izin, Alpa) for that range.
9. WHEN attendance data is loading, THE Sekolah_Admin SHALL display skeleton placeholders for the student list.

---

### Requirement 8: Jadwal Mengajar (Opsional)

**User Story:** Sebagai Guru, saya ingin melihat jadwal mengajar mingguan saya, sehingga saya dapat mempersiapkan pelajaran dan tidak melewatkan kelas.

#### Acceptance Criteria

1. WHEN a Guru navigates to the schedule page, THE Sekolah_Admin SHALL display a weekly grid with Monday through Saturday as columns and time slots from 07:00 to 17:00 in 45-minute increments as rows, showing subject name and assigned class in each occupied cell.
2. WHEN a Guru views the schedule, THE Sekolah_Admin SHALL display only the schedule entries assigned to that Guru.
3. WHERE the schedule management feature is enabled, THE Sekolah_Admin SHALL allow Staf_Admin to add, edit, and delete schedule entries via a form containing day, time slot, subject, and assigned class.
4. WHEN Staf_Admin saves a schedule entry with no conflicts, THE Sekolah_Admin SHALL persist the entry and display a success confirmation message in Bahasa Indonesia.
5. IF a schedule entry being saved assigns the same Guru to two different classes in the same time slot, THEN THE Sekolah_Admin SHALL reject the save and display a conflict error message in Bahasa Indonesia indicating the conflicting Guru name and time slot.
6. IF a Guru has no schedule entries assigned, THEN THE Sekolah_Admin SHALL display an empty state message in Bahasa Indonesia indicating that no schedule has been assigned.

---

### Requirement 9: Catatan Siswa (Opsional)

**User Story:** Sebagai Guru, saya ingin mencatat perilaku atau prestasi siswa, sehingga perkembangan setiap siswa terdokumentasi dengan baik.

#### Acceptance Criteria

1. WHERE the student notes feature is enabled, THE Sekolah_Admin SHALL allow a Guru to create a note for a specific Siswa containing a category (Perilaku or Prestasi), a date no later than the current date, and a note text of 1 to 1000 characters.
2. WHEN a user navigates to the Student Detail page, THE Sekolah_Admin SHALL display all notes for that Siswa in reverse chronological order by note date.
3. WHEN a Guru saves a note, THE Sekolah_Admin SHALL associate the note with the authenticated Guru's profile as the author.
4. WHEN a Guru edits or deletes a note and the authenticated user is the original author or holds the Staf_Admin role, THE Sekolah_Admin SHALL apply the requested edit or deletion to the note.
5. IF a Guru attempts to edit or delete a note and the authenticated user is neither the original author nor holds the Staf_Admin role, THEN THE Sekolah_Admin SHALL reject the action and display an error message indicating insufficient permissions, leaving the note unchanged.

---

### Requirement 10: Nilai (Opsional)

**User Story:** Sebagai Guru, saya ingin memasukkan nilai siswa berdasarkan komponen nilai yang telah ditentukan, sehingga nilai akhir terhitung otomatis dan konsisten.

#### Acceptance Criteria

1. WHERE the grades feature is enabled, THE Sekolah_Admin SHALL allow Staf_Admin to define Komponen_Nilai for a Kelas and Semester, each with a name of at most 100 characters and a weight percentage between 1 and 100.
2. WHEN Staf_Admin saves the Komponen_Nilai configuration for a Kelas and Semester, THE Sekolah_Admin SHALL validate that the sum of all weight percentages equals exactly 100 and display an error message in Bahasa Indonesia if it does not.
3. IF the total weight percentages for a Kelas and Semester do not equal 100, THEN THE Sekolah_Admin SHALL prevent Guru from opening the grade input table for that Kelas and Semester and display an explanation message in Bahasa Indonesia.
4. WHEN Guru selects a Kelas and Semester with valid Komponen_Nilai, THE Sekolah_Admin SHALL display a grade input table with Siswa as rows and Komponen_Nilai as columns.
5. WHEN a Guru saves grades, THE Sekolah_Admin SHALL automatically calculate the weighted average final score for each Siswa, rounded to 2 decimal places, on a scale of 0 to 100.
6. WHEN the final score for a Siswa is calculated, THE Sekolah_Admin SHALL convert it to a letter grade using the active Skala_Nilai configuration.
7. IF no active Skala_Nilai configuration exists when letter grade conversion is required, THEN THE Sekolah_Admin SHALL display an error message in Bahasa Indonesia and leave the letter grade field empty until an active Skala_Nilai is configured.
8. WHEN a Guru saves grades for a Kelas and Semester, THE Sekolah_Admin SHALL display per-class statistics including the average, highest, and lowest final scores for that Kelas and Semester.
9. IF a grade value entered is outside the range 0–100, THEN THE Sekolah_Admin SHALL display a validation error in Bahasa Indonesia and prevent the value from being saved.

---

### Requirement 11: Laporan

**User Story:** Sebagai Guru atau Kepala_Sekolah, saya ingin mencetak atau mengekspor laporan kehadiran dan rapor siswa, sehingga data sekolah dapat dikomunikasikan kepada orang tua dan dinas pendidikan.

#### Acceptance Criteria

1. WHEN a Guru or Kepala_Sekolah selects a Kelas and a date range of up to 366 days and requests an attendance report, THE Sekolah_Admin SHALL generate a printable PDF containing an attendance recap that lists each Siswa's total present, absent, sick, and permitted days within the selected date range.
2. WHEN a Guru or Kepala_Sekolah selects a Siswa and a Semester and requests a report card, THE Sekolah_Admin SHALL generate a printable PDF containing the Siswa's grade per subject (including midterm and final scores) and attendance summary (total present, absent, sick, and permitted days) for the selected Semester.
3. WHEN a user triggers PDF generation, THE Sekolah_Admin SHALL display a loading indicator and complete PDF generation within 10 seconds for an attendance report covering up to 40 students or a single-student report card.
4. IF PDF generation has not completed within 10 seconds, THEN THE Sekolah_Admin SHALL cancel the generation, dismiss the loading indicator, and display an error message indicating that the report could not be generated.
5. IF no attendance or grade data exists for the selected Kelas, Siswa, date range, or Semester, THEN THE Sekolah_Admin SHALL display an error message indicating that no data is available and SHALL NOT generate a PDF.
6. THE Sekolah_Admin SHALL format all dates in reports as dd MMMM yyyy in Bahasa Indonesia (contoh: 01 Januari 2026).
7. THE Sekolah_Admin SHALL format all numeric values in reports using a dot as the thousands separator (contoh: 1.000).

---

### Requirement 12: Manajemen Pengguna

**User Story:** Sebagai Staf_Admin, saya ingin mengelola akun pengguna dan menetapkan peran, sehingga hanya orang yang berwenang yang dapat mengakses sistem.

#### Acceptance Criteria

1. IF a user without the Staf_Admin or Kepala_Sekolah role attempts to access the User Management page, THEN THE Sekolah_Admin SHALL redirect the user to the main dashboard and display an error message indicating insufficient permissions.
2. THE Sekolah_Admin SHALL display a list of all user accounts showing full name, email, role, and account creation date, sorted by account creation date in descending order.
3. WHEN Staf_Admin clicks "Tambah Pengguna", THE Sekolah_Admin SHALL open a form requiring email (valid format, maximum 254 characters), full name (1–100 characters), and role selection (Guru, Kepala_Sekolah, or Staf_Admin), where all three fields are mandatory before submission is enabled.
4. WHEN a new user account is submitted via the form and the email address does not already exist in the system, THE Sekolah_Admin SHALL invoke the Supabase Admin API to create the account and send an invitation email to the provided address.
5. IF the email address provided in the "Tambah Pengguna" form already exists in the system, THEN THE Sekolah_Admin SHALL display an error message indicating the email is already registered and SHALL NOT create a duplicate account.
6. WHEN Staf_Admin updates a user's role and the update operation completes successfully, THE Sekolah_Admin SHALL reflect the new role value in the displayed user list within 3 seconds.
7. IF a role update operation fails, THEN THE Sekolah_Admin SHALL display an error message indicating the update failed and SHALL retain the user's previous role value in the displayed list.
8. WHEN Staf_Admin deactivates a user account and confirms the confirmation dialog, THE Sekolah_Admin SHALL disable the account so that the affected user can no longer log in, and SHALL update the account status in the displayed list to inactive.
9. IF Kepala_Sekolah accesses the User Management page, THEN THE Sekolah_Admin SHALL display the user list in read-only mode without add, edit, or delete controls.

---

### Requirement 13: Pengaturan

**User Story:** Sebagai Staf_Admin, saya ingin mengonfigurasi informasi sekolah, tahun ajaran aktif, dan skala nilai, sehingga seluruh data aplikasi mencerminkan kondisi sekolah yang sesungguhnya.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL provide a settings page where any authenticated user can view and update their own profile including full name (1–100 characters) and an optional display photo (JPG or PNG, maximum 2 MB).
2. IF a user attempts to upload a profile photo that is not JPG or PNG format or exceeds 2 MB, THEN THE Sekolah_Admin SHALL reject the upload and display an error message in Bahasa Indonesia without changing the existing photo.
3. THE Sekolah_Admin SHALL provide a school information section in settings where Staf_Admin can update the school name (1–100 characters), address (1–255 characters), and principal name (1–100 characters).
4. THE Sekolah_Admin SHALL provide an academic year management section where Staf_Admin can create a new Tahun_Ajaran in the format YYYY/YYYY where the second year equals the first year plus one.
5. WHEN a Tahun_Ajaran is set as active, THE Sekolah_Admin SHALL mark all other Tahun_Ajaran records as inactive and automatically create two associated Semester records (Ganjil and Genap) if they do not yet exist.
6. THE Sekolah_Admin SHALL provide a grade scale management section where Staf_Admin can define Skala_Nilai by specifying minimum score (0–100 integer), maximum score (0–100 integer), and letter grade (1–3 characters) for each range.
7. WHEN Staf_Admin saves the Skala_Nilai configuration, THE Sekolah_Admin SHALL validate that the ranges together cover exactly 0 to 100 with no gaps and no overlaps and display a validation error in Bahasa Indonesia if violations are detected.
8. IF a non-Staf_Admin user attempts to submit changes to school information, academic year, or grade scales, THEN THE Sekolah_Admin SHALL reject the request and display an error message in Bahasa Indonesia without persisting the changes.
9. IF an unauthenticated user attempts to access the settings page, THEN THE Sekolah_Admin SHALL redirect the user to the login page.

---

### Requirement 14: UX dan Umpan Balik Pengguna

**User Story:** Sebagai pengguna, saya ingin mendapat umpan balik visual yang jelas untuk setiap tindakan yang saya lakukan, sehingga saya selalu tahu apakah suatu tindakan berhasil atau gagal.

#### Acceptance Criteria

1. WHEN any create, update, or delete operation succeeds, THE Sekolah_Admin SHALL display a toast notification in the top-right corner with a success indicator and a message in Bahasa Indonesia that auto-dismisses after 4 seconds.
2. WHEN any create, update, or delete operation fails, THE Sekolah_Admin SHALL display a toast notification in the top-right corner with an error indicator and a message in Bahasa Indonesia that persists until the user dismisses it via a close button within the toast.
3. WHEN a user submits a form with validation errors, THE Sekolah_Admin SHALL display inline error messages in Bahasa Indonesia directly below each invalid field without clearing previously entered valid data.
4. WHEN a user initiates a delete action on any record, THE Sekolah_Admin SHALL display a confirmation dialog containing the record name, a "Hapus" confirmation button, and a "Batal" cancel button, and SHALL NOT proceed with deletion unless the user clicks "Hapus".
5. WHEN a page or table has been loading data for more than 300 milliseconds, THE Sekolah_Admin SHALL display skeleton loading placeholders that match the number of columns and rows of the expected content layout.
6. IF a list or table contains no records, THEN THE Sekolah_Admin SHALL display an empty-state view with an illustration and a message in Bahasa Indonesia that describes why the list is empty or how to add the first record.
7. THE Sekolah_Admin SHALL use a minimum body font size of 16px and maintain a color contrast ratio of at least 4.5:1 (WCAG AA) for all non-decorative text elements.
8. THE Sekolah_Admin SHALL support dark mode, toggling between light and dark themes based on the user's operating system preference, and SHALL persist a manual theme selection made via the top bar toggle across sessions until the user changes it again.
9. THE Sekolah_Admin SHALL visually differentiate success toast notifications from error toast notifications using distinct icon shapes and background colors such that a user can distinguish the outcome without reading the message text.

---

### Requirement 15: Performa dan Kompatibilitas Browser

**User Story:** Sebagai pengguna, saya ingin aplikasi yang memuat cepat dan berjalan mulus di browser modern apapun, sehingga saya tidak terganggu oleh lambatnya respons sistem.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL implement code splitting per route using React lazy loading so that each page's JavaScript bundle is loaded on demand.
2. THE Sekolah_Admin SHALL implement pagination on all list and table views containing potentially large datasets (Siswa, Kehadiran, Nilai), displaying a maximum of 50 rows per page with page navigation controls.
3. WHEN a user changes an attendance status, THE Sekolah_Admin SHALL immediately update the UI to reflect the new status before receiving a server response, and IF the server request fails, THEN THE Sekolah_Admin SHALL revert the UI to the previous status and display an error message indicating the change could not be saved.
4. THE Sekolah_Admin SHALL support the latest stable versions of Chrome, Firefox, Edge, and Safari at the time of release.
5. THE Sekolah_Admin SHALL render correctly and be fully usable on screen widths from 320px (mobile) to 1920px (desktop), using responsive Tailwind CSS breakpoints.
6. WHEN any page is loaded for the first time, THE Sekolah_Admin SHALL complete the initial render within 3 seconds on a standard broadband connection of at least 10 Mbps.

---

### Requirement 16: Struktur Kode dan Folder

**User Story:** Sebagai developer, saya ingin kode diorganisir berdasarkan fitur dengan komponen yang kecil dan terfokus, sehingga proyek mudah dipahami, diperluas, dan dipelihara.

#### Acceptance Criteria

1. THE Sekolah_Admin SHALL organize source code by feature domain (contoh: `src/features/students/`, `src/features/attendance/`) rather than by file type.
2. THE Sekolah_Admin SHALL place any component used in two or more feature domains in `src/components/ui/`; components used exclusively within a single feature SHALL remain in that feature's directory.
3. THE Sekolah_Admin SHALL isolate all Supabase client initialization and query functions in `src/services/` or `src/lib/` — no direct import or invocation of the Supabase client outside these directories in any React component file.
4. THE Sekolah_Admin SHALL limit each file to one primary exported component or function; private helper functions and constants used only within the same file are permitted.
5. THE Sekolah_Admin SHALL use Zustand or React Context for any state shared across two or more feature domains or routes (including authenticated user, active academic year, and theme), and SHALL NOT rely on prop-drilling beyond two component levels for such shared state.

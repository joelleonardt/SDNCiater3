---
inclusion: always
---

# Product

**Sekolah Admin** is a school administration web app for Indonesian schools. It lets teachers, school principals (`Kepala_Sekolah`), and admin staff (`Staf_Admin`) manage classes, students, attendance, schedules, grades, and reports through a role-gated dashboard.

## Roles

| Role | Access |
|---|---|
| `Guru` | Dashboard, Classes (read-only), Students (read-only + Notes CRUD), Attendance (input & recap), Schedules (read-only), Grades (input scores), Reports, Settings (profile) |
| `Kepala_Sekolah` | Dashboard, Classes (read-only), Students (read-only), Attendance (read-only), Schedules (read-only), Grades (read-only), Reports, Users (read-only), Settings (profile + read-only school config) |
| `Staf_Admin` | Full access (CRUD) to Dashboard, Classes, Students, Attendance, Schedules, Grades, Reports, Users, Settings |

## Domain entities

`schools` → `profiles` (users) → `classes` → `students` → `attendance`, `grades`, `schedules`, `notes`, `grade_components`, `grade_scales`

Academic structure: `academic_years` → `semesters` → classes/schedules.

## Language

UI and codebase comments are in **Indonesian** (Bahasa Indonesia).

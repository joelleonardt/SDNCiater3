---
inclusion: always
---

# Product

**Sekolah Admin** is a school administration web app for Indonesian schools. It lets teachers, school principals (`Kepala_Sekolah`), and admin staff (`Staf_Admin`) manage classes, students, attendance, schedules, grades, and reports through a role-gated dashboard.

## Roles

| Role | Access |
|---|---|
| `Guru` | Dashboard, Attendance, Classes, Students, Schedules, Grades, Reports, Settings |
| `Kepala_Sekolah` | Dashboard, Attendance, Schedules, Grades, Reports, Users, Settings |
| `Staf_Admin` | Dashboard, Attendance, Classes, Students, Schedules, Grades, Users, Settings |

## Domain entities

`schools` → `profiles` (users) → `classes` → `students` → `attendance`, `grades`, `schedules`, `notes`, `grade_components`, `grade_scales`

Academic structure: `academic_years` → `semesters` → classes/schedules.

## Language

UI and codebase comments are in **Indonesian** (Bahasa Indonesia).

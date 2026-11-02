// Auto-generated database types based on Supabase schema
// Tables: profiles, schools, academic_years, semesters, classes,
//         students, class_students, attendance, schedules, notes,
//         grade_components, grades, grade_scales

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          school_id: string | null
          full_name: string
          role: 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'
          avatar_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          school_id?: string | null
          full_name: string
          role: 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string | null
          full_name?: string
          role?: 'Guru' | 'Kepala_Sekolah' | 'Staf_Admin'
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      schools: {
        Row: {
          id: string
          name: string
          address: string
          principal_name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          principal_name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          principal_name?: string
          created_at?: string
        }
      }
      academic_years: {
        Row: {
          id: string
          school_id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          is_active?: boolean
          created_at?: string
        }
      }
      semesters: {
        Row: {
          id: string
          academic_year_id: string
          name: 'Ganjil' | 'Genap'
        }
        Insert: {
          id?: string
          academic_year_id: string
          name: 'Ganjil' | 'Genap'
        }
        Update: {
          id?: string
          academic_year_id?: string
          name?: 'Ganjil' | 'Genap'
        }
      }
      classes: {
        Row: {
          id: string
          school_id: string
          academic_year_id: string
          name: string
          grade_level: number
          homeroom_teacher_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          academic_year_id: string
          name: string
          grade_level: number
          homeroom_teacher_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          academic_year_id?: string
          name?: string
          grade_level?: number
          homeroom_teacher_id?: string | null
          created_at?: string
        }
      }
      students: {
        Row: {
          id: string
          school_id: string
          full_name: string
          nis: string
          gender: 'Laki-laki' | 'Perempuan'
          date_of_birth: string
          parent_name: string | null
          parent_contact: string | null
          is_deleted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          full_name: string
          nis: string
          gender: 'Laki-laki' | 'Perempuan'
          date_of_birth: string
          parent_name?: string | null
          parent_contact?: string | null
          is_deleted?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          full_name?: string
          nis?: string
          gender?: 'Laki-laki' | 'Perempuan'
          date_of_birth?: string
          parent_name?: string | null
          parent_contact?: string | null
          is_deleted?: boolean
          created_at?: string
        }
      }
      class_students: {
        Row: {
          id: string
          class_id: string
          student_id: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
        }
        Update: {
          id?: string
          class_id?: string
          student_id?: string
        }
      }
      attendance: {
        Row: {
          id: string
          class_id: string
          student_id: string
          date: string
          status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
          date: string
          status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          student_id?: string
          date?: string
          status?: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'
          created_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          class_id: string
          teacher_id: string
          subject: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          class_id: string
          teacher_id: string
          subject: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          class_id?: string
          teacher_id?: string
          subject?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
        }
      }
      notes: {
        Row: {
          id: string
          student_id: string
          author_id: string
          category: 'Perilaku' | 'Prestasi'
          note_date: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          author_id: string
          category: 'Perilaku' | 'Prestasi'
          note_date: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          author_id?: string
          category?: 'Perilaku' | 'Prestasi'
          note_date?: string
          content?: string
          created_at?: string
        }
      }
      grade_components: {
        Row: {
          id: string
          class_id: string
          semester_id: string
          name: string
          weight: number
        }
        Insert: {
          id?: string
          class_id: string
          semester_id: string
          name: string
          weight: number
        }
        Update: {
          id?: string
          class_id?: string
          semester_id?: string
          name?: string
          weight?: number
        }
      }
      grades: {
        Row: {
          id: string
          student_id: string
          grade_component_id: string
          score: number
        }
        Insert: {
          id?: string
          student_id: string
          grade_component_id: string
          score: number
        }
        Update: {
          id?: string
          student_id?: string
          grade_component_id?: string
          score?: number
        }
      }
      grade_scales: {
        Row: {
          id: string
          school_id: string
          min_score: number
          max_score: number
          letter: string
        }
        Insert: {
          id?: string
          school_id: string
          min_score: number
          max_score: number
          letter: string
        }
        Update: {
          id?: string
          school_id?: string
          min_score?: number
          max_score?: number
          letter?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Convenience type aliases ────────────────────────────────────────────────

type Tables = Database['public']['Tables']

// Row types (full records returned from SELECT)
export type Profile = Tables['profiles']['Row']
export type School = Tables['schools']['Row']
export type AcademicYear = Tables['academic_years']['Row']
export type Semester = Tables['semesters']['Row']
export type Class = Tables['classes']['Row']
export type Student = Tables['students']['Row']
export type ClassStudent = Tables['class_students']['Row']
export type Attendance = Tables['attendance']['Row']
export type Schedule = Tables['schedules']['Row']
export type Note = Tables['notes']['Row']
export type GradeComponent = Tables['grade_components']['Row']
export type Grade = Tables['grades']['Row']
export type GradeScale = Tables['grade_scales']['Row']

// Insert types (used when creating new records)
export type ProfileInsert = Tables['profiles']['Insert']
export type SchoolInsert = Tables['schools']['Insert']
export type AcademicYearInsert = Tables['academic_years']['Insert']
export type SemesterInsert = Tables['semesters']['Insert']
export type ClassInsert = Tables['classes']['Insert']
export type StudentInsert = Tables['students']['Insert']
export type ClassStudentInsert = Tables['class_students']['Insert']
export type AttendanceInsert = Tables['attendance']['Insert']
export type ScheduleInsert = Tables['schedules']['Insert']
export type NoteInsert = Tables['notes']['Insert']
export type GradeComponentInsert = Tables['grade_components']['Insert']
export type GradeInsert = Tables['grades']['Insert']
export type GradeScaleInsert = Tables['grade_scales']['Insert']

// Update types (partial, used for PATCH / UPDATE operations)
export type ProfileUpdate = Tables['profiles']['Update']
export type SchoolUpdate = Tables['schools']['Update']
export type AcademicYearUpdate = Tables['academic_years']['Update']
export type SemesterUpdate = Tables['semesters']['Update']
export type ClassUpdate = Tables['classes']['Update']
export type StudentUpdate = Tables['students']['Update']
export type ClassStudentUpdate = Tables['class_students']['Update']
export type AttendanceUpdate = Tables['attendance']['Update']
export type ScheduleUpdate = Tables['schedules']['Update']
export type NoteUpdate = Tables['notes']['Update']
export type GradeComponentUpdate = Tables['grade_components']['Update']
export type GradeUpdate = Tables['grades']['Update']
export type GradeScaleUpdate = Tables['grade_scales']['Update']

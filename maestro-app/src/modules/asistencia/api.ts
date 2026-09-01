import { apiFetch } from '@/lib/api'

export interface Course {
  id: number
  grade: string
  parallel: string
  shift: string
  level: string
}

export interface SchedulePeriod {
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  course: Course
  teacherSubjectCourse: { subject: { id: number; name: string; campo: string } }
}

export interface ScheduleDay {
  day: number
  dayName: string
  periods: SchedulePeriod[]
}

export type AttendanceStatus = 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'LICENCIA'

export interface AttendanceStudent {
  studentId: number
  firstName: string
  lastName: string
  status: AttendanceStatus
  note: string
}

// Ventana de asistencia (backend, studentAttendance.service.ts): se abre 5
// min antes del período y cierra 10 min después; DIRECTOR/SECRETARY quedan
// exentos (exempt:true, open siempre true) — sin pantalla propia todavía.
export interface AttendanceWindow {
  exempt: boolean
  open: boolean
  message: string | null
  opensAt: string | null
  closesAt: string | null
}

export interface AttendanceByCourse {
  date: string
  students: AttendanceStudent[]
  summary: { total: number; presentes: number; ausentes: number; retrasos: number; licencias: number; registrado: boolean }
  window: AttendanceWindow
}

export interface TutorInfo {
  id: number
  firstName: string
  lastName: string
  phone: string | null
}

interface AssignmentWithTutor {
  student: { id: number; parents: { isTutor: boolean; parent: TutorInfo }[] }
}

export interface TodayStatus {
  isHoliday: boolean
  message: string | null
}

export const asistenciaApi = {
  getTodayStatus: () => apiFetch<TodayStatus>('/api/student-attendance/today-status'),
  getMySchedule: () => apiFetch<ScheduleDay[]>('/api/schedules/my-schedule'),
  getMyCourses: () => apiFetch<Course[]>('/api/student-attendance/my-courses'),
  getCourseAttendance: (courseId: number) => apiFetch<AttendanceByCourse>(`/api/student-attendance/course/${courseId}`),
  saveAttendance: (courseId: number, attendances: { studentId: number; status: AttendanceStatus; note?: string }[]) =>
    apiFetch<{ message: string; count: number; notifications: number }>(`/api/student-attendance/course/${courseId}`, {
      method: 'POST',
      body: JSON.stringify({ attendances }),
    }),
  // Tutor de cada estudiante (para el botón "Notificar") — el roster de
  // asistencia no trae el tutor, así que se cruza con esta llamada aparte.
  async getTutorsByStudent(courseId: number): Promise<Record<number, TutorInfo | undefined>> {
    const rows = await apiFetch<AssignmentWithTutor[]>(`/api/students/by-course/${courseId}`)
    const map: Record<number, TutorInfo | undefined> = {}
    for (const row of rows) map[row.student.id] = row.student.parents[0]?.parent
    return map
  },
}

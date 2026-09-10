import { apiFetch } from '@/lib/api'

export interface Course { id: number; grade: string; parallel: string; level: string; shift: string }

export interface StudentLookup {
  id: number
  firstName: string
  lastName: string
  rude: string | null
  course: Course
}

export interface RosterStudent {
  student: { id: number; firstName: string; lastName: string; rude: string | null; isActive: boolean }
}

export interface LateArrival {
  id: number
  studentId: number
  courseId: number
  arrivalTime: string
  minutesLate: number
  enteredClass: boolean
  notifiedAt: string | null
}

export const tardanzasApi = {
  getCourses: () => apiFetch<Course[]>('/api/courses'),

  // Escaneo de QR — el RUDE es el contenido del código.
  getStudentByRude: (rude: string) => apiFetch<StudentLookup>(`/api/students/by-rude/${encodeURIComponent(rude)}`),

  // Búsqueda manual — se elige un curso y se pica de la lista, sin QR a mano.
  getStudentsByCourse: (courseId: number) => apiFetch<RosterStudent[]>(`/api/students/by-course/${courseId}`),

  register: (studentId: number, courseId: number, arrivalTime: string, enteredClass: boolean) =>
    apiFetch<{ message: string; lateArrival: LateArrival }>('/api/student-late-arrivals', {
      method: 'POST',
      body: JSON.stringify({ studentId, courseId, arrivalTime, enteredClass }),
    }),

  notify: (id: number) =>
    apiFetch<{ message: string }>(`/api/student-late-arrivals/${id}/notify`, { method: 'POST' }),

  registerLicense: (studentId: number, startDate: string, endDate: string, reason?: string) =>
    apiFetch<{ message: string }>('/api/student-licenses', {
      method: 'POST',
      body: JSON.stringify({ studentId, startDate, endDate, reason }),
    }),
}

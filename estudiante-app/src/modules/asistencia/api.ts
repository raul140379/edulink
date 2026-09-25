import { apiFetch } from '@/lib/api'

export type AttendanceStatus = 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'LICENCIA'

// Un estado por día (ya colapsado en el backend — si el estudiante tuvo
// varios bloques/materias ese día, gana el mejor estado; ver
// studentAttendance.service.ts getStudentHistory + collapseToDailyStatus).
// onLicense/note reflejan el overlay de licencia (Opción A): tapa el día sin
// tocar la fila real de asistencia que hubiera debajo, si la hay.
export interface AttendanceDay {
  date: string
  status: AttendanceStatus
  onLicense: boolean
  note: string | null
}

export interface AttendanceHistory {
  days: AttendanceDay[]
  summary: { total: number; presentes: number; ausentes: number; retrasos: number; licencias: number }
}

// Perfil propio del estudiante -- resuelve el studentId real (necesario para
// /history/:studentId) y el curso, para mostrarlo en pantalla sin pedirle
// nada al estudiante (a diferencia de padre-app, acá no hay selector de
// hijos: un estudiante es siempre uno solo).
export interface MyProfile {
  id: number
  firstName: string
  lastName: string
  course: { id: number; level: string; grade: string; parallel: string; shift: string } | null
}

export const asistenciaApi = {
  getMyProfile: () => apiFetch<MyProfile>('/api/students/me'),
  // month en formato "YYYY-MM" — sin mes, trae el historial completo.
  getHistory: (studentId: number, month?: string) =>
    apiFetch<AttendanceHistory>(`/api/student-attendance/history/${studentId}${month ? `?month=${month}` : ''}`),
}

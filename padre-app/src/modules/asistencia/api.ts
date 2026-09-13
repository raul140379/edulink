import { apiFetch } from '@/lib/api'

export type AttendanceStatus = 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'LICENCIA'

// Un estado por día (ya colapsado en el backend — si el hijo tuvo varios
// bloques/materias ese día, gana el mejor estado; ver
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

export const asistenciaApi = {
  // month en formato "YYYY-MM" — sin mes, trae el historial completo.
  getHistory: (studentId: number, month?: string) =>
    apiFetch<AttendanceHistory>(`/api/student-attendance/history/${studentId}${month ? `?month=${month}` : ''}`),
}

import { StudentAttendanceStatus } from '@prisma/client'

// Desde el 4-sep-2026, un curso puede tener varias filas de StudentAttendance
// para el MISMO estudiante+día (una por cada maestro que registró — ver
// migración student_attendance_teacher_scoped_unique). Todo lo que antes
// asumía "1 fila = 1 día" (gamificación: racha, calendario semanal, %
// asistencia, mes perfecto) necesita colapsar esas filas a un solo estado
// por día antes de usarlas. Regla ya confirmada con el usuario: si CUALQUIER
// fila del día es PRESENTE, ese día cuenta como presente — no hace falta que
// sea la primera ni la de un maestro en particular. Se generaliza a una
// prioridad (mejor estado gana) para los demás casos, sin ambigüedad.
const PRIORITY: Record<StudentAttendanceStatus, number> = {
  PRESENTE: 4, RETRASO: 3, LICENCIA: 2, AUSENTE: 1,
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function collapseToDailyStatus(
  rows: { date: Date; status: StudentAttendanceStatus }[],
): Map<string, StudentAttendanceStatus> {
  const byDate = new Map<string, StudentAttendanceStatus>()
  for (const r of rows) {
    const key = dateKey(r.date)
    const current = byDate.get(key)
    if (!current || PRIORITY[r.status] > PRIORITY[current]) byDate.set(key, r.status)
  }
  return byDate
}

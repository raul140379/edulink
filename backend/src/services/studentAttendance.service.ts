import { Role } from '@prisma/client'
import { studentAttendanceRepository } from '../repositories/studentAttendance.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { nowMinutesBolivia, todayDayOfWeekBolivia, todayDateRangeBolivia, todayDateStrBolivia, parseTimeToMinutes } from '../utils/bolivia-time'
import { SaveAttendanceInput, CloseAttendanceInput } from '../schemas/studentAttendance.schema'
import { gamificationService } from './gamification.service'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

// Exportado para que reportService (reporte diario de cumplimiento) calcule
// el mismo rango de "un día" que ya usa esta pantalla — evita que ambos
// puedan llegar a discrepar sobre qué cuenta como "ese día".
//
// Corrección de huso horario (3-sep-2026): la versión anterior usaba
// `new Date(dateStr)` + `.setHours(0,0,0,0)`, que interpreta "medianoche" en
// la hora LOCAL del proceso — en el servidor de producción (siempre en UTC)
// coincidía por casualidad con la fecha pedida, pero en cualquier máquina en
// otro huso (ej. esta máquina local, América/La_Paz, UTC-4) se corría un día
// hacia atrás. Ahora se parsean año/mes/día del string directamente y se
// ancla en 00:00 UTC de esa fecha vía Date.UTC — sin tocar ningún método
// dependiente de la zona horaria del proceso (ni `setHours` ni `setDate`).
// "Hoy" (sin dateStr) usa el día calendario de Bolivia (todayDateStrBolivia),
// no el del servidor, por el mismo motivo.
//
// Se ancla a propósito en 00:00 UTC de la fecha (no en medianoche Bolivia,
// 04:00 UTC, como sí hace todayDateRangeBolivia) — es el mismo punto que ya
// usaba producción antes de este fix (servidor en UTC, donde el bug anterior
// nunca se notó), así los registros de asistencia ya guardados siguen
// encontrándose exacto, sin correrse un día hacia atrás.
export function dayRange(dateStr?: string) {
  const ds = dateStr || todayDateStrBolivia(new Date())
  const [y, m, d] = ds.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + 1)
  return { base, next }
}

function formatHM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export interface AttendanceWindow {
  exempt: boolean
  open: boolean
  message: string | null
  opensAt: string | null
  closesAt: string | null
}

// Ventana de asistencia: se abre 5 min antes del período y cierra 10 min
// después — pero es la ventana de ESTE maestro para ESTE curso hoy, no del
// curso en abstracto (la asistencia es una vez por curso por día, cualquier
// maestro asignado al curso puede tomarla, así que se mira la unión de
// TODOS los períodos que este maestro específico tiene hoy en este curso).
// DIRECTOR/SECRETARY quedan exentos — pueden registrar/corregir en
// cualquier momento (sin pantalla propia todavía, backend preparado).
async function resolveAttendanceWindow(userId: number | undefined, courseId: number, academicYearId: number): Promise<AttendanceWindow> {
  const ctx = getTenantContext()
  if (ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY) {
    return { exempt: true, open: true, message: null, opensAt: null, closesAt: null }
  }

  const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
  if (!teacher) return { exempt: false, open: false, message: 'Maestro no encontrado', opensAt: null, closesAt: null }

  const now = new Date()

  // Feriado de hoy (planificado con anticipación o creado el mismo día) —
  // ni siquiera mira los períodos del maestro si hoy no hay clases.
  const { start, next } = todayDateRangeBolivia(now)
  const holiday = await studentAttendanceRepository.findHolidayForToday(academicYearId, start, next)
  if (holiday) {
    return { exempt: false, open: false, opensAt: null, closesAt: null, message: `Hoy no hay clases: ${holiday.description}.` }
  }

  const dow = todayDayOfWeekBolivia(now)
  const nowMin = nowMinutesBolivia(now)
  const periods = await studentAttendanceRepository.findTeacherPeriodsForCourseToday(teacher.id, courseId, dow, academicYearId)

  if (periods.length === 0) {
    return { exempt: false, open: false, message: 'No tenés esta materia programada hoy en este curso.', opensAt: null, closesAt: null }
  }

  const windows = periods
    .map((p) => ({ start: parseTimeToMinutes(p.startTime) - 5, end: parseTimeToMinutes(p.endTime) + 10 }))
    .sort((a, b) => a.start - b.start)

  const open = windows.some((w) => nowMin >= w.start && nowMin <= w.end)
  if (open) return { exempt: false, open: true, message: null, opensAt: null, closesAt: null }

  const upcoming = windows.find((w) => w.start > nowMin)
  if (upcoming) {
    return {
      exempt: false, open: false, opensAt: formatHM(upcoming.start), closesAt: null,
      message: `La asistencia se habilita a las ${formatHM(upcoming.start)}.`,
    }
  }

  const last = windows[windows.length - 1]
  return {
    exempt: false, open: false, opensAt: null, closesAt: formatHM(last.end),
    message: `La ventana para tomar asistencia de este curso ya cerró a las ${formatHM(last.end)}.`,
  }
}

export const studentAttendanceService = {
  // Estado del día — SOLO el feriado, sin depender de un curso específico.
  // Usado por la pantalla "Ahora" de maestro-app para no mostrar "te toca
  // ahora"/"no tenés más clases hoy" (mensajes de horario, sin relación con
  // el feriado) cuando en realidad hoy no hay clases — mismo chequeo que ya
  // usa resolveAttendanceWindow, para que ambas pantallas digan lo mismo.
  async getTodayStatus() {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) return { isHoliday: false, message: null }

    const { start, next } = todayDateRangeBolivia(new Date())
    const holiday = await studentAttendanceRepository.findHolidayForToday(activeYear.id, start, next)

    return holiday
      ? { isHoliday: true, message: `Hoy no hay clases: ${holiday.description}.` }
      : { isHoliday: false, message: null }
  },

  async getAttendanceByCourse(userId: number | undefined, courseId: number, date?: string) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const window = await resolveAttendanceWindow(userId, courseId, activeYear.id)

    const { base, next } = dayRange(date)

    const assignments = await studentAttendanceRepository.findAssignmentsForCourse(courseId, activeYear.id)
    const attendances = await studentAttendanceRepository.findAttendancesForCourseDateWithTeacher(courseId, activeYear.id, base, next)

    const attendanceMap: Record<number, any> = {}
    attendances.forEach((a) => { attendanceMap[a.studentId] = a })

    const students = assignments.map((a) => ({
      studentId: a.student.id,
      firstName: a.student.firstName,
      lastName:  a.student.lastName,
      gender:    a.student.gender,
      attendance: attendanceMap[a.student.id] || null,
      status:    attendanceMap[a.student.id]?.status || 'PRESENTE',
      note:      attendanceMap[a.student.id]?.note || '',
    }))

    // Nombre de quien REALMENTE registró (de la fila guardada), no de quien
    // está mirando la pantalla ahora — para el PDF con firma de respaldo.
    // null si el día todavía no se registró.
    const teacherName = attendances[0]?.teacher
      ? `${attendances[0].teacher.firstName} ${attendances[0].teacher.lastName}`
      : null

    const summary = {
      total:      students.length,
      presentes:  attendances.filter((a) => a.status === 'PRESENTE').length,
      ausentes:   attendances.filter((a) => a.status === 'AUSENTE').length,
      retrasos:   attendances.filter((a) => a.status === 'RETRASO').length,
      licencias:  attendances.filter((a) => a.status === 'LICENCIA').length,
      registrado: attendances.length > 0,
    }

    return { date: base.toISOString().split('T')[0], students, summary, window, teacherName }
  },

  async saveAttendance(userId: number | undefined, courseId: number, input: SaveAttendanceInput) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const ctx = getTenantContext()
    const isExemptRole = ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY

    // teacherId: a quién se le atribuye el registro (FK obligatoria).
    // actorLabel: qué nombre ve el padre en la notificación de inasistencia.
    // Se separan porque DIRECTOR/SECRETARY no tienen Teacher propio — no
    // corresponde atribuirle la corrección a otro maestro que no la hizo.
    let teacherId: number
    let actorLabel: string

    if (isExemptRole) {
      const resolvedTeacherId = await studentAttendanceRepository.findAnyTeacherIdForCourse(courseId)
      if (!resolvedTeacherId) throw new HttpError(400, 'Este curso no tiene ningún maestro asignado — no se puede registrar asistencia.')
      teacherId = resolvedTeacherId
      actorLabel = 'Dirección'
    } else {
      const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
      if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

      const window = await resolveAttendanceWindow(userId, courseId, activeYear.id)
      if (!window.open) throw new HttpError(403, window.message || 'Fuera de la ventana permitida para tomar asistencia.')

      teacherId = teacher.id
      actorLabel = `${teacher.lastName} ${teacher.firstName}`
    }

    const course = await studentAttendanceRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const { base } = dayRange(input.date)
    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    let count = 0
    let notifCount = 0

    for (const att of input.attendances) {
      const existing = await studentAttendanceRepository.findOneForDay(att.studentId, courseId, base)

      await studentAttendanceRepository.upsertAttendance({
        studentId: att.studentId, courseId, teacherId, academicYearId: activeYear.id,
        date: base, status: att.status, note: att.note || null,
      })
      count++

      // XP y racha solo la primera vez que se registra este día para este
      // estudiante — si un profesor corrige PRESENTE→RETRASO el mismo día no
      // debe volver a sumar.
      if (!existing && (att.status === 'PRESENTE' || att.status === 'RETRASO')) {
        await gamificationService.awardXp(att.studentId, gamificationService.XP_ATTENDANCE_DAY)
        await gamificationService.recalculateStreak(att.studentId)
      }

      if (att.status === 'AUSENTE' || att.status === 'RETRASO') {
        const statusLabel = att.status === 'AUSENTE' ? 'ausente' : 'con retraso'
        const emoji = att.status === 'AUSENTE' ? '❌' : '⏰'
        const title = `${emoji} Inasistencia — ${cursoLabel}`
        const message = `Su hijo/a estuvo ${statusLabel} el ${dateStr} en el curso ${cursoLabel}. Maestro: ${actorLabel}.${att.note ? ` Observación: ${att.note}` : ''}`

        const parentLink = await studentAttendanceRepository.findTutorLink(att.studentId)
        if (parentLink?.parent) {
          await studentAttendanceRepository.createNotification({ title, message, sentById: userId!, parentId: parentLink.parent.id })
          notifCount++
        }
      }
    }

    return {
      message: `Asistencia guardada: ${count} registros${notifCount > 0 ? ` · ${notifCount} notificación(es) enviada(s)` : ''}`,
      count, notifications: notifCount,
    }
  },

  async getMyCourses(userId: number | undefined) {
    const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const assignments = await studentAttendanceRepository.findMyCourses(teacher.id)
    return assignments.map((a) => a.course)
  },

  async getStudentHistory(studentId: number, courseId?: number, month?: string) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    let dateFilter: { gte: Date; lt: Date } | undefined
    if (month) {
      const [year, m] = month.split('-').map(Number)
      dateFilter = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) }
    }

    const attendances = await studentAttendanceRepository.findStudentHistory(studentId, activeYear.id, courseId, dateFilter)

    const summary = {
      total:     attendances.length,
      presentes: attendances.filter((a) => a.status === 'PRESENTE').length,
      ausentes:  attendances.filter((a) => a.status === 'AUSENTE').length,
      retrasos:  attendances.filter((a) => a.status === 'RETRASO').length,
      licencias: attendances.filter((a) => a.status === 'LICENCIA').length,
    }

    return { attendances, summary }
  },

  async closeAttendance(userId: number | undefined, courseId: number, input: CloseAttendanceInput) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    // Mismo candado que saveAttendance — sin esto, un maestro bloqueado por
    // la ventana horaria podría igual marcar ausentes masivos por esta vía.
    const ctx = getTenantContext()
    const isExemptRole = ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY

    let teacherId: number
    let actorLabel: string

    if (isExemptRole) {
      const resolvedTeacherId = await studentAttendanceRepository.findAnyTeacherIdForCourse(courseId)
      if (!resolvedTeacherId) throw new HttpError(400, 'Este curso no tiene ningún maestro asignado — no se puede registrar asistencia.')
      teacherId = resolvedTeacherId
      actorLabel = 'Dirección'
    } else {
      const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
      if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

      const window = await resolveAttendanceWindow(userId, courseId, activeYear.id)
      if (!window.open) throw new HttpError(403, window.message || 'Fuera de la ventana permitida para tomar asistencia.')

      teacherId = teacher.id
      actorLabel = `${teacher.lastName} ${teacher.firstName}`
    }

    const course = await studentAttendanceRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const { base, next } = dayRange(input.date)
    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    const assignments = await studentAttendanceRepository.findAssignmentsForCourse(courseId, activeYear.id)
    const existing = await studentAttendanceRepository.findAttendancesForCourseDate(courseId, activeYear.id, base, next)

    const registeredIds = new Set(existing.map((e) => e.studentId))
    const sinRegistro = assignments.filter((a) => !registeredIds.has(a.student.id))

    if (sinRegistro.length === 0) return { message: 'Todos los estudiantes ya tienen asistencia registrada', count: 0, notifications: 0 }

    let notifCount = 0
    for (const a of sinRegistro) {
      await studentAttendanceRepository.upsertAttendance({
        studentId: a.student.id, courseId, teacherId, academicYearId: activeYear.id,
        date: base, status: 'AUSENTE', note: 'Registrado automáticamente al cerrar asistencia',
      })

      const parentLink = await studentAttendanceRepository.findTutorLink(a.student.id)
      if (parentLink?.parent) {
        await studentAttendanceRepository.createNotification({
          title: `❌ Inasistencia — ${cursoLabel}`,
          message: `Su hijo/a estuvo ausente el ${dateStr} en el curso ${cursoLabel}. Maestro: ${actorLabel}.`,
          sentById: userId!, parentId: parentLink.parent.id,
        })
        notifCount++
      }
    }

    return {
      message: `Asistencia cerrada: ${sinRegistro.length} estudiante(s) marcado(s) como ausente · ${notifCount} notificación(es) enviada(s)`,
      count: sinRegistro.length, notifications: notifCount,
    }
  },
}

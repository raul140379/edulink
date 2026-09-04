import { Role } from '@prisma/client'
import { studentAttendanceRepository } from '../repositories/studentAttendance.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { nowMinutesBolivia, todayDayOfWeekBolivia, todayDateRangeBolivia, todayDateStrBolivia, parseTimeToMinutes } from '../utils/bolivia-time'
import { groupIntoBlocks, AttendanceBlockRange } from '../utils/attendance-blocks'
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

// Día de la semana (1=lunes..7=domingo) de una fecha YA anclada a 00:00 UTC
// por dayRange() — a diferencia de todayDayOfWeekBolivia (que sí necesita el
// offset de Bolivia porque trabaja con "ahora", un instante real con
// ambigüedad cerca de medianoche), acá no hace falta ningún ajuste: `base`
// ya representa sin ambigüedad un día calendario fijo, así que sus
// componentes UTC son directamente ese día calendario.
export function dayOfWeekFromBase(base: Date): number {
  const dow = base.getUTCDay()
  return dow === 0 ? 7 : dow
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
  // Bloque real que está abierto AHORA MISMO (5-sep-2026) — null si la
  // ventana está cerrada, o si el rol es exento (DIRECTOR/SECRETARY no
  // tienen un bloque propio, corrigen el curso completo).
  block: AttendanceBlockRange | null
}

// Ventana de asistencia: se abre 5 min antes del PRIMER período del bloque y
// cierra 10 min después del ÚLTIMO — un maestro con 3 períodos seguidos
// (ej. 3°,4°,5°) tiene UNA ventana continua para todo el bloque, no 3
// ventanas sueltas con huecos entre medio. Bloques no seguidos del mismo
// maestro (ej. 1°,2° y luego 5°,6°) generan ventanas separadas, cada una con
// su propio abre/cierra — así un maestro entre sus 2 bloques ve "cerrado,
// se habilita a las X" en vez de quedar con una ventana falsamente abierta.
// DIRECTOR/SECRETARY quedan exentos — pueden registrar/corregir en
// cualquier momento (sin pantalla propia todavía, backend preparado).
async function resolveAttendanceWindow(userId: number | undefined, courseId: number, academicYearId: number): Promise<AttendanceWindow> {
  const ctx = getTenantContext()
  if (ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY) {
    return { exempt: true, open: true, message: null, opensAt: null, closesAt: null, block: null }
  }

  const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
  if (!teacher) return { exempt: false, open: false, message: 'Maestro no encontrado', opensAt: null, closesAt: null, block: null }

  const now = new Date()

  // Feriado de hoy (planificado con anticipación o creado el mismo día) —
  // ni siquiera mira los períodos del maestro si hoy no hay clases.
  const { start, next } = todayDateRangeBolivia(now)
  const holiday = await studentAttendanceRepository.findHolidayForToday(academicYearId, start, next)
  if (holiday) {
    return { exempt: false, open: false, opensAt: null, closesAt: null, message: `Hoy no hay clases: ${holiday.description}.`, block: null }
  }

  const dow = todayDayOfWeekBolivia(now)
  const nowMin = nowMinutesBolivia(now)
  const periods = await studentAttendanceRepository.findTeacherPeriodsForCourseDay(teacher.id, courseId, dow, academicYearId)

  if (periods.length === 0) {
    return { exempt: false, open: false, message: 'No tenés esta materia programada hoy en este curso.', opensAt: null, closesAt: null, block: null }
  }

  const blocks = groupIntoBlocks(periods)
  const windows = blocks
    .map((b) => ({ block: b, start: parseTimeToMinutes(b.startTime) - 5, end: parseTimeToMinutes(b.endTime) + 10 }))
    .sort((a, b) => a.start - b.start)

  const openWindow = windows.find((w) => nowMin >= w.start && nowMin <= w.end)
  if (openWindow) return { exempt: false, open: true, message: null, opensAt: null, closesAt: null, block: openWindow.block }

  const upcoming = windows.find((w) => w.start > nowMin)
  if (upcoming) {
    return {
      exempt: false, open: false, opensAt: formatHM(upcoming.start), closesAt: null, block: null,
      message: `La asistencia se habilita a las ${formatHM(upcoming.start)}.`,
    }
  }

  const last = windows[windows.length - 1]
  return {
    exempt: false, open: false, opensAt: null, closesAt: formatHM(last.end), block: null,
    message: `La ventana para tomar asistencia de este curso ya cerró a las ${formatHM(last.end)}.`,
  }
}

// Bloque a usar para LEER (no escribir) una fecha específica — que puede no
// ser hoy, o ser hoy pero fuera de cualquier ventana en vivo. Si la fecha
// pedida es hoy y hay un bloque en vivo abierto ahora mismo, se usa ese
// (coincide exacto con lo que saveAttendance también usaría). Si no, se
// recalculan los bloques del maestro para el día de la semana de la fecha
// pedida y se toma el PRIMERO (más temprano) como default determinístico —
// limitación conocida hasta que exista una pantalla real de selección de
// bloque (ver Próximos pasos): un maestro con 2 bloques no seguidos solo ve
// el primero al mirar una fecha pasada por esta vía.
async function resolveReadBlock(
  teacherId: number, courseId: number, date: Date, academicYearId: number, liveBlock: AttendanceBlockRange | null,
): Promise<AttendanceBlockRange | null> {
  const { base: todayBase } = dayRange()
  if (date.getTime() === todayBase.getTime() && liveBlock) return liveBlock

  const dow = dayOfWeekFromBase(date)
  const periods = await studentAttendanceRepository.findTeacherPeriodsForCourseDay(teacherId, courseId, dow, academicYearId)
  const blocks = groupIntoBlocks(periods)
  return blocks[0] ?? null
}

// Bloque "sin período" — camino DIRECTOR/SECRETARY cuando el maestro
// resuelto (findAnyTeacherIdForCourse) no tiene NINGÚN período programado
// ese día de la semana (caso raro: TeacherSubjectCourse existe pero el
// horario todavía no se generó para esa materia). Nunca se deja sin bloque
// — así la clave única (studentId, blockId) sigue protegiendo incluso en
// este camino de corrección administrativa.
const NO_PERIOD_BLOCK: AttendanceBlockRange = { periodStart: 0, periodEnd: 0, startTime: '00:00', endTime: '00:00', subjectId: null }

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

    const ctx = getTenantContext()
    const isExemptRole = ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY
    const myTeacher = isExemptRole ? null : await studentAttendanceRepository.findTeacherByUserId(userId)

    const assignments = await studentAttendanceRepository.findAssignmentsForCourse(courseId, activeYear.id)
    const allAttendances = await studentAttendanceRepository.findAttendancesForCourseDateWithTeacher(courseId, activeYear.id, base, next)

    let rawAttendances = allAttendances
    let resolvedBlock: AttendanceBlockRange | null = null

    if (myTeacher) {
      // Desde el 5-sep-2026 (rediseño por bloques) un maestro real ve/edita
      // SOLO el bloque que le corresponde a esta fecha — separa tanto de
      // otros maestros del mismo curso (ya resuelto el 4-sep) como de sus
      // PROPIOS tramos no seguidos el mismo curso/día (ej. 1°,2° vs 5°,6°,
      // el caso que el fix de anoche no cubría).
      resolvedBlock = await resolveReadBlock(myTeacher.id, courseId, base, activeYear.id, window.block)

      if (resolvedBlock) {
        const existingBlock = await studentAttendanceRepository.findAttendanceBlockByNaturalKey(courseId, base, resolvedBlock.periodStart)
        rawAttendances = existingBlock ? allAttendances.filter((a) => a.blockId === existingBlock.id) : []
      } else {
        rawAttendances = []
      }
    }

    // rawAttendances ya viene ordenado updatedAt desc (heredado de
    // allAttendances) — primero-visto-gana da la fila más reciente por
    // estudiante (relevante sobre todo para DIRECTOR/SECRETARY, donde puede
    // haber varios maestros/bloques mezclados).
    const attendanceMap: Record<number, any> = {}
    rawAttendances.forEach((a) => { if (!attendanceMap[a.studentId]) attendanceMap[a.studentId] = a })

    // Licencias (5-sep-2026, Opción A): se consultan en batch y TAPAN el
    // estado de quien tenga una activa esta fecha, sin importar si el
    // maestro ya había registrado algo por debajo (nunca se toca esa fila
    // real, solo se ignora para la vista/conteos).
    const licenses = await studentAttendanceRepository.findActiveLicensesForStudents(assignments.map((a) => a.student.id), base)
    const licenseByStudent = new Map(licenses.map((l) => [l.studentId, l.reason]))

    const resolvedStatusByStudent = new Map<number, string>()
    Object.values(attendanceMap).forEach((a: any) => resolvedStatusByStudent.set(a.studentId, a.status))
    licenseByStudent.forEach((_reason, studentId) => resolvedStatusByStudent.set(studentId, 'LICENCIA'))

    const students = assignments.map((a) => {
      const onLicense = licenseByStudent.has(a.student.id)
      return {
        studentId: a.student.id,
        firstName: a.student.firstName,
        lastName:  a.student.lastName,
        gender:    a.student.gender,
        attendance: attendanceMap[a.student.id] || null,
        status:    resolvedStatusByStudent.get(a.student.id) || 'PRESENTE',
        note:      onLicense ? (licenseByStudent.get(a.student.id) || 'Licencia') : (attendanceMap[a.student.id]?.note || ''),
        onLicense,
      }
    })

    // Nombre de quien REALMENTE registró — con un maestro real esto ya
    // siempre es uno mismo (o null si todavía no guardó nada en ESTE
    // bloque); con DIRECTOR/SECRETARY sigue siendo "quien tocó esto por
    // última vez entre todos los maestros/bloques del curso", para el PDF
    // con firma de respaldo.
    const teacherName = rawAttendances[0]?.teacher
      ? `${rawAttendances[0].teacher.firstName} ${rawAttendances[0].teacher.lastName}`
      : null

    // Conteos sobre el estado RESUELTO (real + licencia superpuesta), no
    // sobre las filas crudas — así un estudiante de licencia sin ninguna
    // fila real todavía cuenta como licencia, no queda afuera.
    const resolvedStatuses = [...resolvedStatusByStudent.values()]
    const summary = {
      total:      students.length,
      presentes:  resolvedStatuses.filter((s) => s === 'PRESENTE').length,
      ausentes:   resolvedStatuses.filter((s) => s === 'AUSENTE').length,
      retrasos:   resolvedStatuses.filter((s) => s === 'RETRASO').length,
      licencias:  resolvedStatuses.filter((s) => s === 'LICENCIA').length,
      registrado: Object.keys(attendanceMap).length > 0,
    }

    return { date: base.toISOString().split('T')[0], students, summary, window, teacherName, block: resolvedBlock }
  },

  async saveAttendance(userId: number | undefined, courseId: number, input: SaveAttendanceInput) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const ctx = getTenantContext()
    const isExemptRole = ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY

    const { base, next } = dayRange(input.date)

    // teacherId: a quién se le atribuye el registro (FK obligatoria).
    // actorLabel: qué nombre ve el padre en la notificación de inasistencia.
    // blockRange: el tramo de períodos (consecutivos) al que pertenece este
    // guardado — se resuelve UNA vez por request y se usa para todo el
    // batch de estudiantes.
    let teacherId: number
    let actorLabel: string
    let blockRange: AttendanceBlockRange

    if (isExemptRole) {
      const resolvedTeacherId = await studentAttendanceRepository.findAnyTeacherIdForCourse(courseId)
      if (!resolvedTeacherId) throw new HttpError(400, 'Este curso no tiene ningún maestro asignado — no se puede registrar asistencia.')
      teacherId = resolvedTeacherId
      actorLabel = 'Dirección'
      blockRange = (await resolveReadBlock(teacherId, courseId, base, activeYear.id, null)) ?? NO_PERIOD_BLOCK
    } else {
      const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
      if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

      const window = await resolveAttendanceWindow(userId, courseId, activeYear.id)
      if (!window.open || !window.block) throw new HttpError(403, window.message || 'Fuera de la ventana permitida para tomar asistencia.')

      teacherId = teacher.id
      actorLabel = `${teacher.lastName} ${teacher.firstName}`
      blockRange = window.block
    }

    const course = await studentAttendanceRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    // El bloque se resuelve/crea UNA sola vez y se CONGELA con el horario
    // vigente ahora — nunca se recalcula en vivo si el horario se edita
    // después (mismo criterio de "el histórico nunca se pierde").
    const block = await studentAttendanceRepository.findOrCreateAttendanceBlock({
      courseId, teacherId, subjectId: blockRange.subjectId, date: base,
      periodStart: blockRange.periodStart, periodEnd: blockRange.periodEnd,
      startTime: blockRange.startTime, endTime: blockRange.endTime,
      academicYearId: activeYear.id,
    })

    let count = 0
    let notifCount = 0

    for (const att of input.attendances) {
      // XP y racha una sola vez por día para este estudiante, sin importar
      // cuántos maestros/bloques distintos lo registren — se chequea ANTES
      // de este guardado si YA hay presente/retraso de CUALQUIER fila hoy.
      const alreadyPresentToday = await studentAttendanceRepository.findAnyPresentOrLateForDay(att.studentId, courseId, base)

      await studentAttendanceRepository.upsertAttendance({
        studentId: att.studentId, courseId, teacherId, blockId: block.id, academicYearId: activeYear.id,
        date: base, status: att.status, note: att.note || null,
      })
      count++

      if (!alreadyPresentToday && (att.status === 'PRESENTE' || att.status === 'RETRASO')) {
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
          // Dedupe: no mandar 2 avisos el mismo día si 2 maestros/bloques
          // distintos marcan al mismo estudiante ausente/con retraso. Se
          // compara contra el rango del día REAL (Bolivia, ahora), no
          // contra `base`/`next` — createdAt de Notification es un
          // timestamp real de cuándo se mandó, no de qué fecha de
          // asistencia trata.
          const { start: notifStart, next: notifNext } = todayDateRangeBolivia(new Date())
          const alreadyNotified = await studentAttendanceRepository.findNotificationSentTodayForParent(parentLink.parent.id, cursoLabel, notifStart, notifNext)
          if (!alreadyNotified) {
            await studentAttendanceRepository.createNotification({ title, message, sentById: userId!, parentId: parentLink.parent.id })
            notifCount++
          }
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

    const { base, next } = dayRange(input.date)

    let teacherId: number
    let actorLabel: string
    let blockRange: AttendanceBlockRange

    if (isExemptRole) {
      const resolvedTeacherId = await studentAttendanceRepository.findAnyTeacherIdForCourse(courseId)
      if (!resolvedTeacherId) throw new HttpError(400, 'Este curso no tiene ningún maestro asignado — no se puede registrar asistencia.')
      teacherId = resolvedTeacherId
      actorLabel = 'Dirección'
      blockRange = (await resolveReadBlock(teacherId, courseId, base, activeYear.id, null)) ?? NO_PERIOD_BLOCK
    } else {
      const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
      if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

      const window = await resolveAttendanceWindow(userId, courseId, activeYear.id)
      if (!window.open || !window.block) throw new HttpError(403, window.message || 'Fuera de la ventana permitida para tomar asistencia.')

      teacherId = teacher.id
      actorLabel = `${teacher.lastName} ${teacher.firstName}`
      blockRange = window.block
    }

    const course = await studentAttendanceRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    const block = await studentAttendanceRepository.findOrCreateAttendanceBlock({
      courseId, teacherId, subjectId: blockRange.subjectId, date: base,
      periodStart: blockRange.periodStart, periodEnd: blockRange.periodEnd,
      startTime: blockRange.startTime, endTime: blockRange.endTime,
      academicYearId: activeYear.id,
    })

    const assignments = await studentAttendanceRepository.findAssignmentsForCourse(courseId, activeYear.id)
    // Desde el 5-sep-2026, "quién falta" se mira POR BLOQUE: separa tanto
    // maestros distintos entre sí como los propios tramos no seguidos de UN
    // mismo maestro (ej. cerrar el bloque 1°,2° no marca como "ya
    // completo" al bloque 5°,6° del mismo maestro). DIRECTOR/SECRETARY
    // siguen viendo el agregado del curso completo, que es su rol.
    const existing = await studentAttendanceRepository.findAttendancesForCourseDate(
      courseId, activeYear.id, base, next, isExemptRole ? undefined : block.id,
    )

    // Licencias (5-sep-2026): un estudiante de licencia nunca se marca
    // AUSENTE automático al cerrar — no le "falta" nada, ya está justificado.
    const licenses = await studentAttendanceRepository.findActiveLicensesForStudents(assignments.map((a) => a.student.id), base)
    const licensedIds = new Set(licenses.map((l) => l.studentId))

    const registeredIds = new Set(existing.map((e) => e.studentId))
    const sinRegistro = assignments.filter((a) => !registeredIds.has(a.student.id) && !licensedIds.has(a.student.id))

    if (sinRegistro.length === 0) return { message: 'Todos los estudiantes ya tienen asistencia registrada', count: 0, notifications: 0 }

    let notifCount = 0
    for (const a of sinRegistro) {
      await studentAttendanceRepository.upsertAttendance({
        studentId: a.student.id, courseId, teacherId, blockId: block.id, academicYearId: activeYear.id,
        date: base, status: 'AUSENTE', note: 'Registrado automáticamente al cerrar asistencia',
      })

      const parentLink = await studentAttendanceRepository.findTutorLink(a.student.id)
      if (parentLink?.parent) {
        const { start: notifStart, next: notifNext } = todayDateRangeBolivia(new Date())
        const alreadyNotified = await studentAttendanceRepository.findNotificationSentTodayForParent(parentLink.parent.id, cursoLabel, notifStart, notifNext)
        if (!alreadyNotified) {
          await studentAttendanceRepository.createNotification({
            title: `❌ Inasistencia — ${cursoLabel}`,
            message: `Su hijo/a estuvo ausente el ${dateStr} en el curso ${cursoLabel}. Maestro: ${actorLabel}.`,
            sentById: userId!, parentId: parentLink.parent.id,
          })
          notifCount++
        }
      }
    }

    return {
      message: `Asistencia cerrada: ${sinRegistro.length} estudiante(s) marcado(s) como ausente · ${notifCount} notificación(es) enviada(s)`,
      count: sinRegistro.length, notifications: notifCount,
    }
  },
}

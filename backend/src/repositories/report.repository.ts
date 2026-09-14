import prisma from '../lib/prisma'
import { Pagination, paginationArgs } from '../utils/pagination'

export const reportRepository = {
  findActiveTeachersWithAssignments() {
    return prisma.teacher.findMany({
      where: { isActive: true },
      include: {
        user: { select: { email: true, isActive: true } },
        assignments: {
          include: {
            subject: { select: { name: true, code: true } },
            course: { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
          },
        },
        tutorCourse: { include: { course: { select: { id: true, level: true, grade: true, parallel: true, shift: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  },

  findCoursesWithDelegateInfo() {
    return prisma.course.findMany({
      include: {
        delegate: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, phone: true,
            user: { select: { email: true } },
            students: { where: { isTutor: true }, include: { student: { select: { firstName: true, lastName: true } } }, take: 1 },
          },
        },
        tutor: { include: { teacher: { select: { firstName: true, lastName: true } } } },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }],
    })
  },

  findAcademicYearById(id: number) {
    return prisma.academicYear.findUnique({ where: { id } })
  },

  // select explícito (no todo el modelo): getAttendanceReport usa
  // startDate/endDate, getTreasuryReport usa id/year (y year llega tal cual
  // al frontend) — así esta lectura no depende de que el schema desplegado
  // esté 100% sincronizado con la DB real (ver CLAUDE.md 18.1, incidente
  // 22-ago-2026, P2022 por una columna nueva sin migrar en producción).
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, year: true, startDate: true, endDate: true },
    })
  },

  // Reporte diario de cumplimiento de asistencia (Administración → Reportes).
  // Deliberadamente SIN la lógica de resolveAttendanceWindow que sí usa
  // studentAttendanceService — esa ventana existe para VALIDAR que se puede
  // GUARDAR asistencia, no para simplemente CONSULTAR un historial. Reusarla
  // acá rompería para REGENTE (tiene ATTENDANCE_VIEW pero no Teacher propio,
  // y a diferencia de DIRECTOR/SECRETARY no está exento en esa función).
  findAllCoursesForSchool() {
    return prisma.course.findMany({
      select: { id: true, grade: true, parallel: true, level: true, shift: true },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }],
    })
  },

  // studentId + orderBy (4-sep-2026): desde que teacherId entró a la clave
  // única de StudentAttendance, un estudiante puede tener varias filas el
  // mismo día (una por maestro) — el servicio necesita studentId para
  // deduplicar antes de contar (si no, un curso con 2 maestros mostraría el
  // doble de "presentes" de los que realmente tiene). orderBy updatedAt
  // desc: para quedarse con la fila más reciente de cada estudiante.
  findAttendancesForSchoolDate(academicYearId: number, start: Date, next: Date) {
    return prisma.studentAttendance.findMany({
      where: { academicYearId, date: { gte: start, lt: next } },
      select: { courseId: true, studentId: true, status: true },
      orderBy: { updatedAt: 'desc' },
    })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({
      where: { id },
      select: { id: true, grade: true, parallel: true, level: true, shift: true },
    })
  },

  // Roster de TODO el colegio en una sola consulta — evita 1 query por
  // curso. Usado tanto por getDailyAttendanceCompliance como por
  // getWeeklyAbsences (mapea studentId -> courseId actual).
  findAllAssignmentsForSchool(academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { academicYearId },
      select: { courseId: true, studentId: true },
    })
  },

  findAssignmentsForCourse(courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      select: { student: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  // Matriz semanal (5-sep-2026): horario COMPLETO esperado del curso para
  // los días de clase — 1 sola consulta, se agrupa en memoria por
  // (dayOfWeek, teacherId) y se corre groupIntoBlocks sobre cada grupo para
  // armar las celdas esperadas de la semana. `days` viene del servicio
  // (lunes-viernes o lunes-sábado según el nivel del curso — SECUNDARIA sí
  // tiene clases el sábado, ver generateSchedule).
  findScheduleForCourseWeek(courseId: number, academicYearId: number, days: number[]) {
    return prisma.schedule.findMany({
      where: { academicYearId, courseId, dayOfWeek: { in: days } },
      select: {
        dayOfWeek: true, period: true, startTime: true, endTime: true,
        teacherSubjectCourse: {
          select: {
            teacherId: true, subjectId: true,
            teacher: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    })
  },

  // Config de horario institucional activa para el turno del curso — usada
  // para saber cuántos períodos tiene el turno en total (maxPeriods), así
  // el frontend puede dibujar columnas vacías para períodos sin clase ese
  // día, en vez de solo los períodos que sí tienen Schedule.
  findActiveSchoolScheduleForShift(shift: string) {
    return prisma.schoolSchedule.findFirst({ where: { shift: shift as any, isActive: true }, select: { periods: true } })
  },

  // Bloques REALES ya registrados en la semana — 1 consulta por rango de
  // fecha (nunca una por día).
  findAttendanceBlocksForCourseWeek(courseId: number, start: Date, end: Date) {
    return prisma.attendanceBlock.findMany({
      where: { courseId, date: { gte: start, lt: end } },
    })
  },

  // Asistencia de TODOS los bloques de la semana en una sola consulta (por
  // blockId, no por día) — para los conteos de cada celda.
  findAttendancesForBlocks(blockIds: number[]) {
    if (blockIds.length === 0) return Promise.resolve([])
    return prisma.studentAttendance.findMany({
      where: { blockId: { in: blockIds } },
      select: { studentId: true, blockId: true, status: true },
    })
  },

  // Licencias que se superponen con CUALQUIER parte de la semana pedida —
  // el ajuste por día/bloque específico se hace en memoria en el servicio
  // (una licencia puede cubrir solo algunos días de la semana, no todos).
  findLicensesOverlappingRange(studentIds: number[], start: Date, end: Date) {
    if (studentIds.length === 0) return Promise.resolve([])
    return prisma.studentLicense.findMany({
      where: { studentId: { in: studentIds }, startDate: { lt: end }, endDate: { gte: start } },
      select: { studentId: true, startDate: true, endDate: true },
    })
  },

  // orderBy updatedAt desc: mismo criterio que studentAttendance.repository.ts
  // — un curso puede tener varios maestros (uno por materia) y cualquiera
  // puede tomar la asistencia compartida del día; sin orden, [0] no era
  // determinístico. El último en tocar el registro es el nombre correcto
  // para la firma de respaldo.
  findAttendancesForCourseDateWithTeacher(courseId: number, academicYearId: number, start: Date, next: Date) {
    return prisma.studentAttendance.findMany({
      where: { courseId, academicYearId, date: { gte: start, lt: next } },
      include: { teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  },

  findChargesForYear(academicYearId: number) {
    return prisma.charge.findMany({
      where: { academicYearId, status: { not: 'ANULADO' } },
      include: {
        parent: { select: { firstName: true, lastName: true, ci: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    })
  },

  // Reuniones de curso dentro de la gestión activa (Meeting no tiene FK a
  // AcademicYear — se acota por rango de fecha de la gestión) + su asistencia.
  findMeetingsInDateRange(start: Date, end: Date) {
    return prisma.meeting.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        course: { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
        attendances: { select: { present: true } },
      },
    })
  },

  findLastClosedAcademicYear() {
    return prisma.academicYear.findFirst({ where: { economicClosedAt: { not: null } }, orderBy: { economicClosedAt: 'desc' } })
  },

  // Cargos de tutor de una gestión ya cerrada que se trasladaron como Deuda
  // Anterior — ANULADO por sí solo no alcanza para distinguir "se trasladó" de
  // "se canceló a mano" (mismo status para ambos casos); carriedCharges no
  // vacío es la única señal confiable, vía el self-relation ChargeCarriedForward.
  // Trae TODOS los hijos tutorados (no solo el primero) con su curso en la
  // gestión de origen — necesario para agrupar por curso (ver
  // reportService.getCarriedDebtReport): un tutor con hijos en cursos
  // distintos debe poder aparecer bajo cada curso correspondiente.
  findCarriedChargesForYear(academicYearId: number) {
    return prisma.charge.findMany({
      where: { academicYearId, status: 'ANULADO', carriedCharges: { some: {} } },
      include: {
        parent: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, kardex: true,
            students: {
              where: { isTutor: true },
              include: {
                student: {
                  select: {
                    firstName: true, lastName: true,
                    assignments: {
                      where: { academicYearId },
                      select: { course: { select: { id: true, level: true, grade: true, parallel: true, shift: true } } },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        carriedCharges: { select: { id: true, amount: true, paidAmount: true, status: true, academicYearId: true, academicYear: { select: { year: true } } } },
      },
      orderBy: { parent: { lastName: 'asc' } },
    })
  },

  findMorosos(academicYearId: number, pagination?: Pagination) {
    return prisma.parent.findMany({
      where: { charges: { some: { academicYearId, status: { in: ['PENDIENTE', 'PARCIAL'] } } } },
      include: {
        charges: { where: { academicYearId, status: { in: ['PENDIENTE', 'PARCIAL'] } }, select: { amount: true, paidAmount: true, status: true, type: true } },
        students: { where: { isTutor: true }, include: { student: { select: { firstName: true, lastName: true } } }, take: 1 },
      },
      orderBy: [{ lastName: 'asc' }],
      ...paginationArgs(pagination),
    })
  },

  countMorosos(academicYearId: number) {
    return prisma.parent.count({
      where: { charges: { some: { academicYearId, status: { in: ['PENDIENTE', 'PARCIAL'] } } } },
    })
  },

  // Reporte de llegadas tarde (Regente), diario y semanal — ver
  // report.service.ts. Consultas propias (no se cruzan con
  // studentLateArrival.repository.ts), mismo criterio ya usado en el resto
  // de este archivo para los reportes de asistencia.
  findLateArrivalsForDate(date: Date) {
    return prisma.studentLateArrival.findMany({
      where: { date },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { id: true, grade: true, parallel: true, level: true } },
      },
      orderBy: [{ courseId: 'asc' }, { arrivalTime: 'asc' }],
    })
  },

  findLateArrivalsForCourseWeek(courseId: number, start: Date, next: Date) {
    return prisma.studentLateArrival.findMany({
      where: { courseId, date: { gte: start, lt: next } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ date: 'asc' }, { arrivalTime: 'asc' }],
    })
  },

  // Reporte de ausentes de la semana (Dirección) — trimestre vigente
  // determinado por FECHA (startDate<=hoy<=endDate), no por `isClosed` (ese
  // flag no refleja de forma confiable el trimestre cronológicamente
  // vigente, confirmado con datos reales de producción 14-sep-2026).
  findCurrentTrimester(academicYearId: number, date: Date) {
    return prisma.trimester.findFirst({
      where: { academicYearId, startDate: { lte: date }, endDate: { gte: date } },
      select: { id: true, name: true, number: true, startDate: true, endDate: true },
    })
  },

  // Toda la asistencia del colegio en un rango arbitrario (usado para el
  // trimestre completo, a diferencia de findAttendancesForSchoolDate que es
  // de un solo día) — 1 sola consulta, sin importar cuántos estudiantes/días
  // tenga el rango. Incluye `date` (a diferencia de la variante diaria, que
  // no la necesita) porque acá hay que colapsar por día con
  // collapseToDailyStatus antes de contar.
  findAttendancesForSchoolRange(academicYearId: number, start: Date, end: Date) {
    return prisma.studentAttendance.findMany({
      where: { academicYearId, date: { gte: start, lte: end } },
      select: { studentId: true, date: true, status: true },
    })
  },

  // Licencias que se superponen con el rango, para TODO el colegio (a
  // diferencia de findLicensesOverlappingRange de arriba, que ya acota por
  // studentIds — acá todavía no sabemos cuáles son, es el primer filtro) —
  // mismo criterio que el resto del sistema: una licencia siempre "tapa" el
  // día real, sin importar qué diga la fila de StudentAttendance de abajo
  // (ver studentAttendance.service.ts). Tabla chica en la práctica (las
  // licencias no son comunes), sin riesgo de N+1.
  findSchoolLicensesOverlappingRange(start: Date, end: Date) {
    return prisma.studentLicense.findMany({
      where: { cancelledAt: null, startDate: { lte: end }, endDate: { gte: start } },
      select: { studentId: true, startDate: true, endDate: true },
    })
  },

  // Detalle (nombre + tutor con teléfono) SOLO de los estudiantes que ya
  // quedaron filtrados por tener >=1 falta esta semana — nunca de todo el
  // colegio, para no traer de más.
  findStudentDetailsWithTutor(studentIds: number[]) {
    if (studentIds.length === 0) return Promise.resolve([])
    return prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true, firstName: true, lastName: true,
        parents: {
          where: { isTutor: true },
          select: { parentId: true, parent: { select: { firstName: true, lastName: true, phone: true } } },
          take: 1,
        },
      },
    })
  },
}

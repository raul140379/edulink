import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const studentAttendanceRepository = {
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findAssignmentsForCourse(courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      include: { student: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  // blockId opcional (5-sep-2026, rediseño por bloques): usado por
  // closeAttendance para saber qué estudiantes le faltan a ESTE bloque
  // específico — un maestro puede tener 2 bloques no seguidos el mismo
  // curso/día (ej. 1°,2° y luego 5°,6°), cada uno con su propio estado de
  // "completo". DIRECTOR/SECRETARY (camino de corrección administrativa,
  // sin bloque real propio) siguen viendo el agregado de todo el curso, a
  // propósito (su rol es corregir el curso completo, no un bloque puntual).
  findAttendancesForCourseDate(courseId: number, academicYearId: number, start: Date, next: Date, blockId?: number) {
    return prisma.studentAttendance.findMany({
      where: { courseId, academicYearId, date: { gte: start, lt: next }, ...(blockId ? { blockId } : {}) },
    })
  },

  // Variante con el maestro incluido — usada por getAttendanceByCourse (para
  // el nombre en el PDF de respaldo con firma) y por el reporte diario del
  // Director.
  //
  // orderBy updatedAt desc: un curso puede tener muchos maestros asignados
  // (uno por materia), y desde el 5-sep-2026 cada maestro puede tener
  // además varios BLOQUES no seguidos el mismo día — así que puede haber
  // varias filas reales por estudiante/curso/día. Este orden se usa para
  // las vistas agregadas (DIRECTOR/SECRETARY, reporte) que necesitan "un
  // solo estado representativo": se toma la fila más reciente por
  // estudiante (primera que aparece en este orden), nunca una al azar.
  findAttendancesForCourseDateWithTeacher(courseId: number, academicYearId: number, start: Date, next: Date) {
    return prisma.studentAttendance.findMany({
      where: { courseId, academicYearId, date: { gte: start, lt: next } },
      include: { teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  },

  findTeacherByUserId(userId: number | undefined) {
    return prisma.teacher.findUnique({ where: { userId }, include: { user: true } })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  // "¿algún maestro YA registró a este estudiante presente/con retraso HOY,
  // en cualquiera de sus propias filas (cualquier bloque)?" — para no dar
  // XP dos veces el mismo día si 2 maestros (o 2 bloques del mismo maestro)
  // registran al mismo estudiante presente cada uno por su lado.
  findAnyPresentOrLateForDay(studentId: number, courseId: number, date: Date) {
    return prisma.studentAttendance.findFirst({
      where: { studentId, courseId, date, status: { in: ['PRESENTE', 'RETRASO'] } },
    })
  },

  // 5-sep-2026: la clave del upsert pasa a ser [studentId, blockId] — un
  // bloque ya identifica sin ambigüedad curso+fecha+maestro+rango de
  // períodos, así que alcanza con blockId para saber si esta fila ya existe.
  upsertAttendance(data: { studentId: number; courseId: number; teacherId: number; blockId: number; academicYearId: number; date: Date; status: string; note: string | null }) {
    return prisma.studentAttendance.upsert({
      where: {
        studentId_blockId: { studentId: data.studentId, blockId: data.blockId },
      },
      update: { status: data.status as any, note: data.note },
      create: {
        studentId: data.studentId, courseId: data.courseId, teacherId: data.teacherId, blockId: data.blockId,
        academicYearId: data.academicYearId, date: data.date, status: data.status as any, note: data.note,
        schoolId: getTenantContext()?.schoolId ?? 0,
      },
    })
  },

  findTutorLink(studentId: number) {
    return prisma.parentStudent.findFirst({ where: { studentId, isTutor: true }, include: { parent: { select: { id: true, userId: true } } } })
  },

  createNotification(data: { title: string; message: string; sentById: number; parentId: number }) {
    return prisma.notification.create({ data: { title: data.title, message: data.message, type: 'ACADEMICA', sentById: data.sentById, parentId: data.parentId, schoolId: getTenantContext()?.schoolId ?? 0 } })
  },

  // Deduplicación de notificaciones: un estudiante puede tener varios
  // maestros (o varios bloques del mismo maestro) registrando su ausencia
  // el mismo día — sin esto, el padre recibiría un aviso por cada uno. Se
  // aproxima "mismo aviso" por padre + curso (vía el rótulo del curso en el
  // título) + rango del día — Notification no guarda studentId propio, así
  // que en el caso rarísimo de mellizos en el MISMO curso, el segundo aviso
  // real se suprimiría por error; aceptado como limitación menor conocida.
  findNotificationSentTodayForParent(parentId: number, cursoLabel: string, start: Date, next: Date) {
    return prisma.notification.findFirst({
      where: { parentId, title: { contains: cursoLabel }, createdAt: { gte: start, lt: next } },
    })
  },

  findMyCourses(teacherId: number) {
    return prisma.teacherSubjectCourse.findMany({ where: { teacherId }, select: { courseId: true, course: true }, distinct: ['courseId'] })
  },

  findStudentHistory(studentId: number, academicYearId: number, courseId?: number, dateFilter?: { gte: Date; lt: Date }) {
    return prisma.studentAttendance.findMany({
      where: { studentId, academicYearId, ...(courseId ? { courseId } : {}), ...(dateFilter ? { date: dateFilter } : {}) },
      orderBy: { date: 'desc' },
    })
  },

  findHolidayForToday(academicYearId: number, start: Date, next: Date) {
    return prisma.holiday.findFirst({ where: { academicYearId, date: { gte: start, lt: next } }, select: { description: true } })
  },

  // Períodos de ESTE maestro para ESTE curso en un día de la semana dado
  // (no necesariamente "hoy" — se reutiliza tanto para la ventana en vivo
  // como para resolver el bloque de una fecha cualquiera, pasada o futura).
  // Incluye `period` y `subjectId` (vía teacherSubjectCourse) porque
  // groupIntoBlocks los necesita: períodos consecutivos Y de la misma
  // materia para cortar en bloques. Se aplana el resultado acá (en vez de
  // devolver el objeto anidado) para que el llamador no tenga que conocer
  // la forma de la relación.
  async findTeacherPeriodsForCourseDay(teacherId: number, courseId: number, dayOfWeek: number, academicYearId: number) {
    const rows = await prisma.schedule.findMany({
      where: { academicYearId, courseId, dayOfWeek, teacherSubjectCourse: { teacherId } },
      select: { period: true, startTime: true, endTime: true, teacherSubjectCourse: { select: { subjectId: true } } },
      orderBy: { period: 'asc' },
    })
    return rows.map((r) => ({ period: r.period, startTime: r.startTime, endTime: r.endTime, subjectId: r.teacherSubjectCourse.subjectId }))
  },

  // Solo LECTURA — a diferencia de findOrCreateAttendanceBlock, nunca crea
  // nada. Usada por getAttendanceByCourse: si nadie guardó todavía nada en
  // este bloque, simplemente no hay datos que mostrar (no hace falta
  // materializar el bloque solo para mirarlo).
  findAttendanceBlockByNaturalKey(courseId: number, date: Date, periodStart: number) {
    return prisma.attendanceBlock.findUnique({
      where: { courseId_date_periodStart: { courseId, date, periodStart } },
    })
  },

  // Encuentra el bloque ya creado para (courseId, date, periodStart), o lo
  // crea si es la primera vez que alguien guarda algo en él — el bloque se
  // CONGELA en ese momento (periodEnd/horarios quedan fijos para siempre,
  // `update: {}` es un no-op a propósito, ver comentario del modelo en
  // schema.prisma). safety check: si el bloque YA existía con un teacherId
  // distinto al resuelto ahora, es una inconsistencia real (un período de
  // un curso/fecha solo puede pertenecer a un maestro) — se loguea pero no
  // se corrige solo, para no enmascarar un bug de resolución.
  async findOrCreateAttendanceBlock(data: {
    courseId: number; teacherId: number; subjectId: number | null; date: Date
    periodStart: number; periodEnd: number; startTime: string; endTime: string
    academicYearId: number
  }) {
    const block = await prisma.attendanceBlock.upsert({
      where: { courseId_date_periodStart: { courseId: data.courseId, date: data.date, periodStart: data.periodStart } },
      update: {},
      create: {
        courseId: data.courseId, teacherId: data.teacherId, subjectId: data.subjectId, date: data.date,
        periodStart: data.periodStart, periodEnd: data.periodEnd,
        startTime: data.startTime, endTime: data.endTime,
        academicYearId: data.academicYearId,
        schoolId: getTenantContext()?.schoolId ?? 0,
      },
    })

    if (block.teacherId !== data.teacherId) {
      console.error(
        `[AttendanceBlock] inconsistencia real: bloque ${block.id} (courseId=${data.courseId}, date=${data.date.toISOString()}, periodStart=${data.periodStart}) ya existía con teacherId=${block.teacherId}, pero se resolvió teacherId=${data.teacherId} — un período de un curso/fecha debería pertenecer a un solo maestro.`,
      )
    }

    return block
  },

  // Licencias activas para un grupo de estudiantes en una fecha dada — UNA
  // consulta en batch (nunca una por estudiante), reutilizada por
  // getAttendanceByCourse, closeAttendance y los reportes/matriz. Opción A
  // (aprobada): esto NUNCA escribe StudentAttendance, solo se consulta acá
  // y el llamador decide "tapar" la vista con LICENCIA — el dato real de
  // abajo (si el maestro ya había marcado algo) queda intacto.
  findActiveLicensesForStudents(studentIds: number[], date: Date) {
    return prisma.studentLicense.findMany({
      where: { studentId: { in: studentIds }, startDate: { lte: date }, endDate: { gte: date } },
      select: { studentId: true, reason: true },
    })
  },

  // Todas las licencias de UN estudiante que se superponen con el rango
  // pedido (usado por getStudentHistory, panel Padres) — sin rango (historial
  // completo sin filtro de mes), trae todas las licencias del estudiante sin
  // acotar, son pocas filas por estudiante en la práctica.
  findLicensesForStudent(studentId: number, start?: Date, end?: Date) {
    return prisma.studentLicense.findMany({
      where: {
        studentId,
        ...(start ? { endDate: { gte: start } } : {}),
        ...(end ? { startDate: { lt: end } } : {}),
      },
      select: { startDate: true, endDate: true, reason: true },
    })
  },

  // StudentAttendance.teacherId es obligatorio, pero DIRECTOR/SECRETARY (que
  // pueden corregir asistencia sin ventana horaria) no tienen su propio
  // Teacher — se le atribuye al tutor del curso, o si no tiene, a cualquier
  // maestro asignado a ese curso. No es un reemplazo de auditoría real (ver
  // CLAUDE.md ítem 17.1) — es solo para satisfacer la FK obligatoria hasta
  // que exista la pantalla admin real (ver Próximos pasos).
  async findAnyTeacherIdForCourse(courseId: number): Promise<number | null> {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { tutor: { select: { teacherId: true } } } })
    if (course?.tutor?.teacherId) return course.tutor.teacherId

    const tsc = await prisma.teacherSubjectCourse.findFirst({ where: { courseId }, select: { teacherId: true } })
    return tsc?.teacherId ?? null
  },
}

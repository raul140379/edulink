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

  // teacherId opcional (4-sep-2026): usado por closeAttendance para saber
  // qué estudiantes le faltan a ESTE maestro específico, no al curso entero
  // — cada maestro tiene su propio registro desde que teacherId entró a la
  // clave única. DIRECTOR/SECRETARY (sin teacherId propio real) siguen
  // viendo el agregado de todo el curso, a propósito (su rol es corregir el
  // curso completo, no un maestro puntual).
  findAttendancesForCourseDate(courseId: number, academicYearId: number, start: Date, next: Date, teacherId?: number) {
    return prisma.studentAttendance.findMany({
      where: { courseId, academicYearId, date: { gte: start, lt: next }, ...(teacherId ? { teacherId } : {}) },
    })
  },

  // Variante con el maestro incluido — usada por getAttendanceByCourse (para
  // el nombre en el PDF de respaldo con firma) y por el reporte diario del
  // Director.
  //
  // orderBy updatedAt desc: un curso puede tener muchos maestros asignados
  // (uno por materia). Desde el 4-sep-2026 cada maestro tiene su PROPIA fila
  // por estudiante (teacherId en la clave única) — así que puede haber
  // varias filas reales por estudiante/curso/día, una por cada maestro que
  // registró. Este orden se usa para las vistas agregadas (DIRECTOR/
  // SECRETARY, reporte) que necesitan "un solo estado representativo": se
  // toma la fila más reciente por estudiante (primera que aparece en este
  // orden), nunca una al azar.
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

  // Reemplaza al viejo findOneForDay (4-sep-2026): la pregunta relevante ya
  // no es "existe la fila de ESTE maestro" (el upsert ya lo resuelve solo,
  // con la clave única nueva) sino "¿algún maestro YA registró a este
  // estudiante presente/con retraso HOY, en cualquiera de sus propias
  // filas?" — para no dar XP dos veces el mismo día si 2 maestros distintos
  // registran al mismo estudiante presente cada uno por su lado.
  findAnyPresentOrLateForDay(studentId: number, courseId: number, date: Date) {
    return prisma.studentAttendance.findFirst({
      where: { studentId, courseId, date, status: { in: ['PRESENTE', 'RETRASO'] } },
    })
  },

  upsertAttendance(data: { studentId: number; courseId: number; teacherId: number; academicYearId: number; date: Date; status: string; note: string | null }) {
    return prisma.studentAttendance.upsert({
      where: {
        studentId_courseId_date_teacherId: {
          studentId: data.studentId, courseId: data.courseId, date: data.date, teacherId: data.teacherId,
        },
      },
      update: { status: data.status as any, note: data.note },
      create: {
        studentId: data.studentId, courseId: data.courseId, teacherId: data.teacherId,
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

  // Deduplicación de notificaciones (4-sep-2026): un estudiante puede tener
  // varios maestros registrando su ausencia el mismo día (uno cada uno, en
  // su propia fila) — sin esto, el padre recibiría una notificación por
  // cada maestro. Se aproxima "mismo aviso" por padre + curso (vía el
  // rótulo del curso en el título) + rango del día — Notification no guarda
  // studentId propio, así que en el caso rarísimo de mellizos en el MISMO
  // curso, el segundo aviso real se suprimiría por error; aceptado como
  // limitación menor conocida, no se resuelve esta noche.
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

  // Períodos que ESTE maestro tiene hoy para ESTE curso — la ventana de
  // asistencia (ver studentAttendance.service.ts) es la unión de [inicio-5,
  // fin+10] de todos ellos, no un horario genérico del curso (la asistencia
  // es una vez por curso por día, cualquier maestro asignado puede tomarla).
  // Feriado de HOY (gestión activa) — si existe, la ventana ni siquiera mira
  // los períodos del maestro (ver resolveAttendanceWindow).
  findHolidayForToday(academicYearId: number, start: Date, next: Date) {
    return prisma.holiday.findFirst({ where: { academicYearId, date: { gte: start, lt: next } }, select: { description: true } })
  },

  findTeacherPeriodsForCourseToday(teacherId: number, courseId: number, dayOfWeek: number, academicYearId: number) {
    return prisma.schedule.findMany({
      where: { academicYearId, courseId, dayOfWeek, teacherSubjectCourse: { teacherId } },
      select: { startTime: true, endTime: true },
    })
  },

  // StudentAttendance.teacherId es obligatorio, pero DIRECTOR/SECRETARY (que
  // pueden corregir asistencia sin ventana horaria) no tienen su propio
  // Teacher — se le atribuye al tutor del curso, o si no tiene, a cualquier
  // maestro asignado a ese curso. No es un reemplazo de auditoría real (ver
  // CLAUDE.md ítem 17.1) — es solo para satisfacer la FK obligatoria hasta
  // que exista la pantalla admin real.
  async findAnyTeacherIdForCourse(courseId: number): Promise<number | null> {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { tutor: { select: { teacherId: true } } } })
    if (course?.tutor?.teacherId) return course.tutor.teacherId

    const tsc = await prisma.teacherSubjectCourse.findFirst({ where: { courseId }, select: { teacherId: true } })
    return tsc?.teacherId ?? null
  },
}

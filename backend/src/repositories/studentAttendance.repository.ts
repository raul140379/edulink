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

  findAttendancesForCourseDate(courseId: number, academicYearId: number, start: Date, next: Date) {
    return prisma.studentAttendance.findMany({ where: { courseId, academicYearId, date: { gte: start, lt: next } } })
  },

  findTeacherByUserId(userId: number | undefined) {
    return prisma.teacher.findUnique({ where: { userId }, include: { user: true } })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  findOneForDay(studentId: number, courseId: number, date: Date) {
    return prisma.studentAttendance.findUnique({ where: { studentId_courseId_date: { studentId, courseId, date } } })
  },

  upsertAttendance(data: { studentId: number; courseId: number; teacherId: number; academicYearId: number; date: Date; status: string; note: string | null }) {
    return prisma.studentAttendance.upsert({
      where: { studentId_courseId_date: { studentId: data.studentId, courseId: data.courseId, date: data.date } },
      update: { status: data.status as any, note: data.note, teacherId: data.teacherId },
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

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

  findAttendancesForSchoolDate(academicYearId: number, start: Date, next: Date) {
    return prisma.studentAttendance.findMany({
      where: { academicYearId, date: { gte: start, lt: next } },
      select: { courseId: true, status: true },
    })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({
      where: { id },
      select: { id: true, grade: true, parallel: true, level: true, shift: true },
    })
  },

  findAssignmentsForCourse(courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      select: { student: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  findAttendancesForCourseDateWithTeacher(courseId: number, academicYearId: number, start: Date, next: Date) {
    return prisma.studentAttendance.findMany({
      where: { courseId, academicYearId, date: { gte: start, lt: next } },
      include: { teacher: { select: { firstName: true, lastName: true } } },
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
}

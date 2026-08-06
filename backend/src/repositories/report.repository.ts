import prisma from '../lib/prisma'

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

  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
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

  findMorosos(academicYearId: number) {
    return prisma.parent.findMany({
      where: { charges: { some: { academicYearId, status: { in: ['PENDIENTE', 'PARCIAL'] } } } },
      include: {
        charges: { where: { academicYearId, status: { in: ['PENDIENTE', 'PARCIAL'] } }, select: { amount: true, paidAmount: true, status: true, type: true } },
        students: { where: { isTutor: true }, include: { student: { select: { firstName: true, lastName: true } } }, take: 1 },
      },
      orderBy: [{ lastName: 'asc' }],
    })
  },
}

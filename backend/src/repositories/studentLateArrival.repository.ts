import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const studentLateArrivalRepository = {
  findStudentById(id: number) {
    return prisma.student.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true, isActive: true } })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id }, select: { id: true, grade: true, parallel: true, shift: true } })
  },

  findActiveSchoolScheduleStartTime(shift: string) {
    return prisma.schoolSchedule.findFirst({ where: { shift: shift as any, isActive: true }, select: { startTime: true } })
  },

  create(data: {
    studentId: number; courseId: number; date: Date; arrivalTime: string; minutesLate: number
    enteredClass: boolean; registeredById: number
  }) {
    return prisma.studentLateArrival.create({
      data: {
        studentId: data.studentId, courseId: data.courseId, date: data.date,
        arrivalTime: data.arrivalTime, minutesLate: data.minutesLate, enteredClass: data.enteredClass,
        registeredById: data.registeredById, schoolId: getTenantContext()?.schoolId ?? 0,
      },
    })
  },

  findById(id: number) {
    return prisma.studentLateArrival.findUnique({
      where: { id },
      include: {
        student: { select: { firstName: true, lastName: true } },
        course: { select: { grade: true, parallel: true } },
      },
    })
  },

  markNotified(id: number) {
    return prisma.studentLateArrival.update({ where: { id }, data: { notifiedAt: new Date() } })
  },

  findTutorLink(studentId: number) {
    return prisma.parentStudent.findFirst({ where: { studentId, isTutor: true }, include: { parent: { select: { id: true } } } })
  },

  createNotification(data: { title: string; message: string; sentById: number; parentId: number }) {
    return prisma.notification.create({
      data: { title: data.title, message: data.message, type: 'ACADEMICA', sentById: data.sentById, parentId: data.parentId, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  // "Ya registrados hoy" — pantalla Home de regente-app y base de los 2
  // reportes (diario/semanal).
  findForCourseDate(courseId: number, date: Date) {
    return prisma.studentLateArrival.findMany({
      where: { courseId, date },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { arrivalTime: 'asc' },
    })
  },

  findForCourseWeek(courseId: number, start: Date, next: Date) {
    return prisma.studentLateArrival.findMany({
      where: { courseId, date: { gte: start, lt: next } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ date: 'asc' }, { arrivalTime: 'asc' }],
    })
  },

  // Todos los cursos de la escuela con al menos una llegada tardía hoy —
  // reporte diario (agrupado por curso).
  findAllForDate(date: Date) {
    return prisma.studentLateArrival.findMany({
      where: { date },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { id: true, grade: true, parallel: true, level: true } },
      },
      orderBy: [{ courseId: 'asc' }, { arrivalTime: 'asc' }],
    })
  },
}

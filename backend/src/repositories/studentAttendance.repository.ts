import prisma from '../lib/prisma'

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

  upsertAttendance(data: { studentId: number; courseId: number; teacherId: number; academicYearId: number; date: Date; status: string; note: string | null }) {
    return prisma.studentAttendance.upsert({
      where: { studentId_courseId_date: { studentId: data.studentId, courseId: data.courseId, date: data.date } },
      update: { status: data.status as any, note: data.note, teacherId: data.teacherId },
      create: {
        studentId: data.studentId, courseId: data.courseId, teacherId: data.teacherId,
        academicYearId: data.academicYearId, date: data.date, status: data.status as any, note: data.note,
      },
    })
  },

  findTutorLink(studentId: number) {
    return prisma.parentStudent.findFirst({ where: { studentId, isTutor: true }, include: { parent: { select: { id: true, userId: true } } } })
  },

  createNotification(data: { title: string; message: string; sentById: number; parentId: number }) {
    return prisma.notification.create({ data: { title: data.title, message: data.message, type: 'ACADEMICA', sentById: data.sentById, parentId: data.parentId } })
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
}

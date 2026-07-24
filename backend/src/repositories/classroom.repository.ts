import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const classroomRepository = {
  findAllActive() {
    return prisma.classroom.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  },

  create(name: string, capacity: number | null) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.classroom.create({ data: { name, capacity, schoolId: getTenantContext()?.schoolId ?? 0 } })
  },

  update(id: number, data: { name?: string; capacity?: number; isActive?: boolean }) {
    return prisma.classroom.update({ where: { id }, data })
  },

  deactivate(id: number) {
    return prisma.classroom.update({ where: { id }, data: { isActive: false } })
  },

  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  assignToPeriod(scheduleId: number, classroomId: number | null) {
    return prisma.schedule.update({
      where: { id: scheduleId },
      data: { classroomId },
      include: {
        classroom: true,
        teacherSubjectCourse: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })
  },

  assignToCourse(courseId: number, academicYearId: number, classroomId: number | null) {
    return prisma.schedule.updateMany({ where: { courseId, academicYearId }, data: { classroomId } })
  },
}

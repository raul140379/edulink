import prisma from '../lib/prisma'

export const planificacionRepository = {
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findAllCourses() {
    return prisma.course.findMany()
  },

  deleteTempPlan(academicYearId: number) {
    return prisma.schedulePlan.deleteMany({ where: { academicYearId, slot: 'TEMP' } })
  },

  findActiveSchoolScheduleForShift(shift: string) {
    return prisma.schoolSchedule.findFirst({ where: { isActive: true, shift: shift as any } })
  },

  findTeacherSubjectCoursesForCourse(courseId: number, grade: string, educationType: string) {
    return prisma.teacherSubjectCourse.findMany({
      where: { courseId },
      include: { subject: { include: { gradeConfigs: { where: { grade: grade as any, educationType: educationType as any } } } } },
    })
  },

  createManyPlans(data: any[]) {
    return prisma.schedulePlan.createMany({ data, skipDuplicates: true })
  },

  findPlansBySlot(academicYearId: number, slot: string) {
    return prisma.schedulePlan.findMany({ where: { academicYearId, slot } })
  },

  deletePlansBySlot(academicYearId: number, slot: string) {
    return prisma.schedulePlan.deleteMany({ where: { academicYearId, slot } })
  },

  findPlansByCourseAndSlot(courseId: number, academicYearId: number, slot: string) {
    return prisma.schedulePlan.findMany({
      where: { courseId, academicYearId, slot },
      include: {
        classroom: true,
        teacherSubjectCourse: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, campo: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    })
  },

  findPlansForTeachersView(academicYearId: number, slot: string) {
    return prisma.schedulePlan.findMany({
      where: { academicYearId, slot },
      include: {
        course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
        teacherSubjectCourse: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, campo: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    })
  },

  countBySlot(academicYearId: number, slot: string) {
    return prisma.schedulePlan.count({ where: { academicYearId, slot } })
  },

  findTeacherSubjectCourseById(id: number) {
    return prisma.teacherSubjectCourse.findUnique({ where: { id } })
  },

  findPlanConflict(academicYearId: number, dayOfWeek: number, period: number, slot: string, teacherId: number) {
    return prisma.schedulePlan.findFirst({
      where: { academicYearId, dayOfWeek, period, slot, teacherSubjectCourse: { teacherId } },
    })
  },

  upsertPlanPeriod(courseId: number, academicYearId: number, dayOfWeek: number, period: number, slot: string, data: {
    startTime: string; endTime: string; teacherSubjectCourseId: number
  }) {
    return prisma.schedulePlan.upsert({
      where: { courseId_academicYearId_dayOfWeek_period_slot: { courseId, academicYearId, dayOfWeek, period, slot } },
      update: data,
      create: { courseId, academicYearId, dayOfWeek, period, slot, ...data },
      include: {
        teacherSubjectCourse: {
          include: {
            teacher: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true, campo: true } },
          },
        },
      },
    })
  },

  deletePlanPeriod(id: number) {
    return prisma.schedulePlan.delete({ where: { id } })
  },

  deleteDraftSchedules(academicYearId: number) {
    return prisma.schedule.deleteMany({ where: { academicYearId, status: 'BORRADOR' } })
  },

  createManySchedules(data: any[]) {
    return prisma.schedule.createMany({ data, skipDuplicates: true })
  },
}

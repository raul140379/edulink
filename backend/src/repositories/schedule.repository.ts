import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const scheduleRepository = {
  findAllSchoolSchedules() {
    return prisma.schoolSchedule.findMany({ orderBy: [{ shift: 'asc' }, { isWinter: 'asc' }] })
  },

  findActiveSchoolScheduleForShift(shift: string) {
    return prisma.schoolSchedule.findFirst({ where: { shift: shift as any, isActive: true } })
  },

  createSchoolSchedule(data: Prisma.SchoolScheduleCreateInput) {
    return prisma.schoolSchedule.create({ data })
  },

  findSchoolScheduleById(id: number) {
    return prisma.schoolSchedule.findUnique({ where: { id } })
  },

  deactivateOthersForShift(shift: string, excludeId: number) {
    return prisma.schoolSchedule.updateMany({ where: { shift: shift as any, id: { not: excludeId } }, data: { isActive: false } })
  },

  updateSchoolSchedule(id: number, data: Prisma.SchoolScheduleUpdateInput) {
    return prisma.schoolSchedule.update({ where: { id }, data })
  },

  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  findSchedulesByCourse(courseId: number, academicYearId: number) {
    return prisma.schedule.findMany({
      where: { courseId, academicYearId },
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

  findTeacherSubjectCourse(id: number, courseId: number) {
    return prisma.teacherSubjectCourse.findFirst({
      where: { id, courseId },
      include: {
        subject: { include: { gradeConfigs: true } },
        course:  { select: { grade: true, educationType: true } },
      },
    })
  },

  countAssignedPeriods(courseId: number, academicYearId: number, teacherSubjectCourseId: number) {
    return prisma.schedule.count({ where: { courseId, academicYearId, teacherSubjectCourseId } })
  },

  findTeacherConflict(academicYearId: number, dayOfWeek: number, period: number, teacherId: number) {
    return prisma.schedule.findFirst({
      where: { academicYearId, dayOfWeek, period, teacherSubjectCourse: { teacherId } },
    })
  },

  upsertPeriod(courseId: number, academicYearId: number, dayOfWeek: number, period: number, data: {
    startTime: string; endTime: string; teacherSubjectCourseId: number
  }) {
    return prisma.schedule.upsert({
      where: { courseId_academicYearId_dayOfWeek_period: { courseId, academicYearId, dayOfWeek, period } },
      update: data,
      create: { courseId, academicYearId, dayOfWeek, period, ...data, status: 'BORRADOR' },
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

  deletePeriod(id: number) {
    return prisma.schedule.delete({ where: { id } })
  },

  findSchedulesByTeacher(academicYearId: number, teacherId: number) {
    return prisma.schedule.findMany({
      where: { academicYearId, teacherSubjectCourse: { teacherId } },
      include: {
        course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
        teacherSubjectCourse: { include: { subject: { select: { id: true, name: true, campo: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    })
  },

  findTeacherByUserId(userId: number | undefined) {
    return prisma.teacher.findFirst({ where: { OR: [{ userId }, { tutorUserId: userId }] } })
  },

  findTeacherSubjectCoursesForCourse(courseId: number, grade: string, educationType: string) {
    return prisma.teacherSubjectCourse.findMany({
      where: { courseId },
      include: {
        subject: {
          include: { gradeConfigs: { where: { grade: grade as any, educationType: educationType as any } } },
        },
      },
    })
  },

  deleteDraftForCourse(courseId: number, academicYearId: number) {
    return prisma.schedule.deleteMany({ where: { courseId, academicYearId, status: 'BORRADOR' } })
  },

  findPublishedSchedules(academicYearId: number) {
    return prisma.schedule.findMany({
      where: { academicYearId, status: 'PUBLICADO' },
      include: { teacherSubjectCourse: { select: { teacherId: true } } },
    })
  },

  createManySchedules(data: any[]) {
    return prisma.schedule.createMany({ data, skipDuplicates: true })
  },

  publishDraftForCourse(courseId: number, academicYearId: number) {
    return prisma.schedule.updateMany({ where: { courseId, academicYearId, status: 'BORRADOR' }, data: { status: 'PUBLICADO' } })
  },

  deleteAllForCourse(courseId: number, academicYearId: number) {
    return prisma.schedule.deleteMany({ where: { courseId, academicYearId } })
  },

  findTeacherSubjectCoursesWithGradeConfig(courseId: number, grade: string, educationType: string) {
    return prisma.teacherSubjectCourse.findMany({
      where: { courseId },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: {
          select: {
            id: true, name: true, campo: true,
            gradeConfigs: { where: { grade: grade as any, educationType: educationType as any } },
          },
        },
      },
    })
  },

  findPublishedSchedulesForCourse(courseId: number, academicYearId: number) {
    return prisma.schedule.findMany({
      where: { courseId, academicYearId, status: 'PUBLICADO' },
      include: { teacherSubjectCourse: { select: { subjectId: true } } },
    })
  },
}

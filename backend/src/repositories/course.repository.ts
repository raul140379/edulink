import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const courseRepository = {
  findMany(where: Prisma.CourseWhereInput) {
    return prisma.course.findMany({
      where,
      include: {
        shiftDirector: { include: { user: { select: { id: true, email: true } } } },
        tutor: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { assignments: true, schedules: true } },
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }, { shift: 'asc' }],
    })
  },

  findById(id: number) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        shiftDirector: { include: { user: { select: { id: true, email: true } } } },
        teacherSubjects: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        tutor: {
          include: {
            teacher: {
              select: {
                id: true, firstName: true, lastName: true, tutorUserId: true,
                tutorUser: { select: { email: true, isActive: true } },
              },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
    })
  },

  findRaw(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  findExact(level: string, grade: string, parallel: string, educationType: string, shift: string) {
    return prisma.course.findUnique({
      where: { level_grade_parallel_educationType_shift: { level: level as any, grade: grade as any, parallel: parallel as any, educationType: educationType as any, shift: shift as any } },
    })
  },

  findConflicting(level: string, grade: string, parallel: string, educationType: string, shift: string, excludeId?: number) {
    return prisma.course.findFirst({
      where: {
        level: level as any, grade: grade as any, parallel: parallel as any, educationType: educationType as any, shift: shift as any,
        ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
      },
    })
  },

  create(data: Prisma.CourseCreateInput) {
    return prisma.course.create({ data, include: { _count: { select: { assignments: true } } } })
  },

  update(id: number, data: Prisma.CourseUpdateInput) {
    return prisma.course.update({ where: { id }, data, include: { _count: { select: { assignments: true } } } })
  },

  countAssignments(courseId: number) {
    return prisma.studentAcademicAssignment.count({ where: { courseId } })
  },

  delete(id: number) {
    return prisma.course.delete({ where: { id } })
  },

  findAssignments(courseId: number, year: number | null) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, ...(year ? { year } : {}) },
      include: { student: { select: { id: true, firstName: true, lastName: true, ci: true, rude: true, birthDate: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findTeacherWithTutorCourse(teacherId: number) {
    return prisma.teacher.findUnique({ where: { id: teacherId }, include: { tutorCourse: true } })
  },

  deleteTutorForCourse(courseId: number) {
    return prisma.courseTutor.deleteMany({ where: { courseId } })
  },

  createTutor(courseId: number, teacherId: number) {
    return prisma.courseTutor.create({ data: { courseId, teacherId } })
  },

  findTutorByCourse(courseId: number) {
    return prisma.courseTutor.findUnique({ where: { courseId } })
  },

  deleteTutorByCourse(courseId: number) {
    return prisma.courseTutor.delete({ where: { courseId } })
  },

  findWithDelegate(id: number) {
    return prisma.course.findUnique({ where: { id }, include: { delegate: true } })
  },

  findWithTutorTeacher(id: number) {
    return prisma.course.findUnique({ where: { id }, include: { tutor: { include: { teacher: true } } } })
  },

  linkDelegateUser(parentId: number, userId: number) {
    return prisma.parent.update({ where: { id: parentId }, data: { delegateUserId: userId } })
  },

  linkTutorUser(teacherId: number, userId: number) {
    return prisma.teacher.update({ where: { id: teacherId }, data: { tutorUserId: userId } })
  },
}

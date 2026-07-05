import { Prisma, Grade, EducationType } from '@prisma/client'
import prisma from '../lib/prisma'

export const subjectRepository = {
  findMany(where: Prisma.SubjectWhereInput, gradeFilter?: string) {
    return prisma.subject.findMany({
      where,
      include: {
        _count: { select: { teacherSubjects: true } },
        ...(gradeFilter ? { gradeConfigs: { where: { grade: gradeFilter as any } } } : {}),
      },
      orderBy: [{ campo: 'asc' }, { name: 'asc' }],
    })
  },

  findRaw(id: number) {
    return prisma.subject.findUnique({ where: { id } })
  },

  findWithAssignmentCount(id: number) {
    return prisma.subject.findUnique({ where: { id }, include: { _count: { select: { teacherSubjects: true } } } })
  },

  create(data: { name: string; code: string | null; level: string; hoursPerWeek: number }) {
    return prisma.subject.create({ data: data as any })
  },

  update(id: number, data: Prisma.SubjectUpdateInput) {
    return prisma.subject.update({ where: { id }, data })
  },

  delete(id: number) {
    return prisma.subject.delete({ where: { id } })
  },

  // ── Plan por curso ────────────────────────────
  findCourseWithAssignments(courseId: number) {
    return prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacherSubjects: {
          include: {
            subject: { select: { id: true, name: true, code: true, campo: true } },
            teacher: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    })
  },

  findGradeConfigsForCourse(grade: Grade, educationType: EducationType) {
    return prisma.subjectGradeConfig.findMany({
      where: { grade, educationType },
      include: { subject: { select: { id: true, name: true, code: true, campo: true, isActive: true } } },
      orderBy: [{ subject: { campo: 'asc' } }, { subject: { name: 'asc' } }],
    })
  },

  // ── Asignación materia-maestro-curso ──────────
  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  findGradeConfig(subjectId: number, grade: Grade, educationType: EducationType) {
    return prisma.subjectGradeConfig.findFirst({ where: { subjectId, grade, educationType } })
  },

  findAssignment(subjectId: number, courseId: number) {
    return prisma.teacherSubjectCourse.findFirst({ where: { subjectId, courseId } })
  },

  updateAssignmentTeacher(id: number, teacherId: number) {
    return prisma.teacherSubjectCourse.update({
      where: { id },
      data:  { teacherId },
      include: {
        subject: { select: { id: true, name: true, code: true, campo: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        course:  { select: { id: true, level: true, grade: true, parallel: true } },
      },
    })
  },

  createAssignment(subjectId: number, teacherId: number, courseId: number) {
    return prisma.teacherSubjectCourse.create({
      data: { subjectId, teacherId, courseId },
      include: {
        subject: { select: { id: true, name: true, code: true, campo: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        course:  { select: { id: true, level: true, grade: true, parallel: true } },
      },
    })
  },

  createAssignmentLean(subjectId: number, teacherId: number, courseId: number) {
    return prisma.teacherSubjectCourse.create({
      data: { subjectId, teacherId, courseId },
      include: {
        subject: { select: { id: true, name: true, code: true, campo: true } },
        course:  { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
      },
    })
  },

  deleteAssignment(id: number) {
    return prisma.teacherSubjectCourse.delete({ where: { id } })
  },

  findOccupiedCourses(subjectId: number) {
    return prisma.teacherSubjectCourse.findMany({
      where: { subjectId },
      select: { courseId: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
    })
  },

  // ── Plan de estudios por grado ─────────────────
  createGradeConfig(subjectId: number, grade: Grade, educationType: EducationType, hoursPerWeek: number) {
    return prisma.subjectGradeConfig.create({
      data: { subjectId, grade, educationType, hoursPerWeek },
      include: { subject: { select: { id: true, name: true, campo: true } } },
    })
  },

  findGradeConfigById(id: number) {
    return prisma.subjectGradeConfig.findUnique({ where: { id } })
  },

  deleteAssignmentsForGrade(subjectId: number, grade: Grade, educationType: EducationType) {
    return prisma.teacherSubjectCourse.deleteMany({ where: { subjectId, course: { grade, educationType } } })
  },

  deleteGradeConfig(id: number) {
    return prisma.subjectGradeConfig.delete({ where: { id } })
  },

  updateGradeConfigHours(id: number, hoursPerWeek: number) {
    return prisma.subjectGradeConfig.update({
      where: { id }, data: { hoursPerWeek },
      include: { subject: { select: { id: true, name: true } } },
    })
  },

  findGradeConfigsBySubject(subjectId: number) {
    return prisma.subjectGradeConfig.findMany({ where: { subjectId }, orderBy: [{ educationType: 'asc' }, { grade: 'asc' }] })
  },
}

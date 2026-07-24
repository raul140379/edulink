import { NotaDimension } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const notaRepository = {
  findAcademicYearByYear(year: number) {
    return prisma.academicYear.findFirst({ where: { year }, include: { trimesters: { orderBy: { number: 'asc' } } } })
  },

  findTrimesterWithYear(trimesterId: number) {
    return prisma.trimester.findUnique({
      where: { id: trimesterId },
      include: { academicYear: { include: { trimesters: { orderBy: { number: 'asc' } } } } },
    })
  },

  findTrimesterRaw(trimesterId: number) {
    return prisma.trimester.findUnique({ where: { id: trimesterId } })
  },

  findNotasForTrimesterCourseSubject(trimesterId: number, courseId: number, subjectId: number) {
    return prisma.nota.findMany({ where: { trimesterId, courseId, subjectId } })
  },

  findTeacherSubjects(teacherId: number) {
    return prisma.teacherSubjectCourse.findMany({ where: { teacherId }, include: { subject: true, course: true } })
  },

  findCourseAssignments(courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      include: { student: { select: { id: true, firstName: true, lastName: true, kardex: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  findNotasByCourse(courseId: number, trimesterId: number | undefined, year: number) {
    return prisma.nota.findMany({
      where: {
        courseId,
        ...(trimesterId ? { trimesterId } : {}),
        trimester: { academicYear: { year } },
      },
      include: {
        student:   { select: { id: true, firstName: true, lastName: true, kardex: true } },
        subject:   { select: { id: true, name: true } },
        teacher:   { select: { id: true, firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
        items:     true,
      },
      orderBy: [{ subject: { name: 'asc' } }, { student: { lastName: 'asc' } }],
    })
  },

  findNotasByStudent(studentId: number, year: number) {
    return prisma.nota.findMany({
      where: { studentId, trimester: { academicYear: { year } } },
      include: {
        subject:   { select: { id: true, name: true } },
        trimester: { select: { id: true, number: true, name: true } },
        course:    { select: { id: true, grade: true, parallel: true, level: true } },
        items:     true,
      },
      orderBy: [{ subject: { name: 'asc' } }, { trimester: { number: 'asc' } }],
    })
  },

  findNotaDetalle(notaId: number) {
    return prisma.nota.findUnique({
      where: { id: notaId },
      include: {
        student:   { select: { id: true, firstName: true, lastName: true } },
        subject:   { select: { id: true, name: true } },
        trimester: { select: { id: true, number: true, name: true } },
        items:     { orderBy: { createdAt: 'asc' } },
      },
    })
  },

  findNotaRaw(id: number) {
    return prisma.nota.findUnique({ where: { id } })
  },

  upsertNota(studentId: number, subjectId: number, courseId: number, teacherId: number, trimesterId: number) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.nota.upsert({
      where: { studentId_subjectId_courseId_trimesterId: { studentId, subjectId, courseId, trimesterId } },
      update: {},
      create: { studentId, subjectId, courseId, teacherId, trimesterId, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  createNotaItem(data: {
    notaId: number; dimension: NotaDimension; titulo: string
    puntaje: number; maxPuntaje: number; fecha: Date | null; taskId: number | null
  }) {
    return prisma.notaItem.create({ data })
  },

  findNotaItemsByNota(notaId: number) {
    return prisma.notaItem.findMany({ where: { notaId } })
  },

  findNotaItemById(id: number) {
    return prisma.notaItem.findUnique({ where: { id } })
  },

  updateNotaItem(id: number, data: { titulo: string; puntaje: number; maxPuntaje: number; fecha: Date | null }) {
    return prisma.notaItem.update({ where: { id }, data })
  },

  deleteNotaItem(id: number) {
    return prisma.notaItem.delete({ where: { id } })
  },

  updateNotaCalculated(notaId: number, data: { saber: number | null; hacer: number | null; total: number | null }) {
    return prisma.nota.update({ where: { id: notaId }, data })
  },

  updateSer(notaId: number, ser: number, total: number | null) {
    return prisma.nota.update({ where: { id: notaId }, data: { ser, total } })
  },

  updateAutoEvaluacion(notaId: number, autoEvaluacion: number, total: number | null) {
    return prisma.nota.update({ where: { id: notaId }, data: { autoEvaluacion, total } })
  },

  cerrarNota(notaId: number) {
    return prisma.nota.update({ where: { id: notaId }, data: { cerrado: true } })
  },

  findTeacherSubjectsForSummary(courseId: number) {
    return prisma.teacherSubjectCourse.findMany({ where: { courseId }, include: { subject: true } })
  },

  findNotasForSummary(courseId: number, academicYearId: number) {
    return prisma.nota.findMany({
      where: { courseId, trimester: { academicYearId } },
      include: { trimester: { select: { number: true } } },
    })
  },
}

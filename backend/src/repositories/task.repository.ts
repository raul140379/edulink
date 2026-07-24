import { Prisma, NotaDimension } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const taskRepository = {
  findByCourse(courseId: number, subjectId?: number, trimesterId?: number) {
    return prisma.task.findMany({
      where: {
        courseId,
        ...(subjectId   ? { subjectId } : {}),
        ...(trimesterId ? { trimesterId } : {}),
      },
      include: {
        subject:   { select: { id: true, name: true, campo: true } },
        teacher:   { select: { id: true, firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
        _count:    { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findActiveAssignmentForStudent(studentId: number) {
    return prisma.studentAcademicAssignment.findFirst({
      where: { studentId, academicYear: { isActive: true } },
      include: { course: true },
    })
  },

  findByCourseForStudent(courseId: number, studentId: number, subjectId?: number, trimesterId?: number) {
    return prisma.task.findMany({
      where: {
        courseId,
        ...(subjectId   ? { subjectId } : {}),
        ...(trimesterId ? { trimesterId } : {}),
      },
      include: {
        subject:   { select: { id: true, name: true, campo: true } },
        teacher:   { select: { id: true, firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
        submissions: { where: { studentId }, select: { id: true, score: true, note: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findStudentByUserId(userId: number | undefined) {
    return prisma.student.findUnique({ where: { userId } })
  },

  findTeacherByUserId(userId: number | undefined) {
    return prisma.teacher.findFirst({ where: { OR: [{ userId }, { tutorUserId: userId }] } })
  },

  createTask(data: Prisma.TaskCreateInput) {
    return prisma.task.create({
      data,
      include: {
        subject:   { select: { id: true, name: true } },
        teacher:   { select: { id: true, firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
      },
    })
  },

  findAssignmentsForCourse(courseId: number) {
    return prisma.studentAcademicAssignment.findMany({ where: { courseId, academicYear: { isActive: true } } })
  },

  createSubmissions(taskId: number, studentIds: number[]) {
    return prisma.taskSubmission.createMany({
      data: studentIds.map((studentId) => ({ taskId, studentId, status: 'PENDIENTE' as const })),
      skipDuplicates: true,
    })
  },

  updateTask(id: number, data: Prisma.TaskUpdateInput) {
    return prisma.task.update({
      where: { id }, data,
      include: {
        subject:   { select: { id: true, name: true } },
        teacher:   { select: { id: true, firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
      },
    })
  },

  deleteTask(id: number) {
    return prisma.task.delete({ where: { id } })
  },

  findSubmissionsByTask(taskId: number) {
    return prisma.taskSubmission.findMany({
      where: { taskId },
      include: { student: { select: { id: true, firstName: true, lastName: true, kardex: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  findTaskRaw(id: number) {
    return prisma.task.findUnique({ where: { id } })
  },

  upsertSubmission(taskId: number, studentId: number, score: number, note: string | null) {
    return prisma.taskSubmission.upsert({
      where: { taskId_studentId: { taskId, studentId } },
      update: { score, note, status: 'CALIFICADO' },
      create: { taskId, studentId, score, note, status: 'CALIFICADO' },
    })
  },

  upsertNota(studentId: number, subjectId: number, courseId: number, teacherId: number, trimesterId: number) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.nota.upsert({
      where: { studentId_subjectId_courseId_trimesterId: { studentId, subjectId, courseId, trimesterId } },
      update: {},
      create: { studentId, subjectId, courseId, teacherId, trimesterId, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  findNotaItemForTask(notaId: number, taskId: number) {
    return prisma.notaItem.findFirst({ where: { notaId, taskId } })
  },

  updateNotaItemScore(id: number, puntaje: number, maxPuntaje: number) {
    return prisma.notaItem.update({ where: { id }, data: { puntaje, maxPuntaje } })
  },

  createNotaItem(data: {
    notaId: number; dimension: NotaDimension; titulo: string
    puntaje: number; maxPuntaje: number; fecha: Date | null; taskId: number
  }) {
    return prisma.notaItem.create({ data })
  },

  findNotaItemsByNota(notaId: number) {
    return prisma.notaItem.findMany({ where: { notaId } })
  },

  findNotaRaw(id: number) {
    return prisma.nota.findUnique({ where: { id } })
  },

  updateNotaCalculated(notaId: number, data: { saber: number | null; hacer: number | null; total: number | null }) {
    return prisma.nota.update({ where: { id: notaId }, data })
  },

  findSubmissionById(id: number) {
    return prisma.taskSubmission.findUnique({ where: { id } })
  },

  updateSubmissionStatus(id: number, status: 'PENDIENTE' | 'CALIFICADO') {
    return prisma.taskSubmission.update({ where: { id }, data: { status } })
  },

  findGradedSubmissionsForStudent(studentId: number, trimesterId?: number) {
    return prisma.taskSubmission.findMany({
      where: {
        studentId, status: 'CALIFICADO',
        task: { ...(trimesterId ? { trimesterId } : {}) },
      },
      include: { task: { select: { type: true, maxScore: true, subject: { select: { id: true, name: true } } } } },
    })
  },
}

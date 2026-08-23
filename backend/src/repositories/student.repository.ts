import { Prisma, Gender, EducationType } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'
import { Pagination, paginationArgs } from '../utils/pagination'

const listInclude = {
  user: { select: { id: true, email: true, role: true, isActive: true } },
  parents: {
    include: {
      parent: { select: { id: true, firstName: true, lastName: true, phone: true, kardex: true } },
    },
  },
  assignments: {
    include: {
      course: true,
      academicYear: { select: { year: true, isActive: true } },
    },
    orderBy: { year: 'desc' as const },
    take: 1,
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.StudentInclude

const detailInclude = {
  user: { select: { id: true, email: true, role: true, isActive: true } },
  parents: {
    include: {
      parent: {
        select: {
          id: true, firstName: true, lastName: true,
          ci: true, phone: true, email: true, address: true,
        },
      },
    },
  },
  assignments: {
    include: {
      course: true,
      academicYear: { select: { id: true, year: true, isActive: true } },
    },
    orderBy: { year: 'desc' as const },
  },
} satisfies Prisma.StudentInclude

// Proyección reducida para STUDENT_VIEW_BASIC (Junta de Núcleo/Distrito): nombre,
// colegio, quién es su padre/tutor y dirección — nunca notas/asistencia/kardex.
const basicSelect = {
  id: true, firstName: true, lastName: true, address: true,
  school: { select: { id: true, name: true } },
  parents: {
    select: { isTutor: true, parent: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.StudentSelect

export const studentRepository = {
  // Cursos donde este usuario da clase (TeacherSubjectCourse) o es tutor de
  // curso (CourseTutor) — usado para acotar listStudents a TEACHER/
  // TEACHER_TUTOR, que solo deben ver estudiantes de sus propios cursos.
  async findTeacherCourseIds(userId: number | undefined): Promise<number[]> {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId }, { tutorUserId: userId }] },
      include: { tutorCourse: { select: { courseId: true } }, assignments: { select: { courseId: true } } },
    })
    if (!teacher) return []

    const ids = new Set<number>(teacher.assignments.map((a) => a.courseId))
    if (teacher.tutorCourse) ids.add(teacher.tutorCourse.courseId)
    return Array.from(ids)
  },

  findMany(where: Prisma.StudentWhereInput, pagination?: Pagination) {
    return prisma.student.findMany({
      where,
      include: listInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...paginationArgs(pagination),
    })
  },

  findManyBasic(where: Prisma.StudentWhereInput, pagination?: Pagination) {
    return prisma.student.findMany({
      where,
      select: basicSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...paginationArgs(pagination),
    })
  },

  findById(id: number) {
    return prisma.student.findUnique({ where: { id }, include: detailInclude })
  },

  findByIdBasic(id: number) {
    return prisma.student.findUnique({ where: { id }, select: basicSelect })
  },

  findRaw(id: number) {
    return prisma.student.findUnique({ where: { id } })
  },

  findByUserId(userId: number | undefined) {
    return prisma.student.findUnique({ where: { userId } })
  },

  findByCI(ci: string) {
    return prisma.student.findFirst({ where: { ci } })
  },

  findByRude(rude: string) {
    return prisma.student.findFirst({ where: { rude } })
  },

  findByKardexAndName(kardex: string, firstName: string, lastName: string) {
    return prisma.student.findFirst({ where: { kardex, firstName, lastName } })
  },

  findByKardex(kardex: string) {
    return prisma.student.findFirst({ where: { kardex } })
  },

  findEnrollments(studentId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { studentId },
      include: {
        course: true,
        academicYear: { select: { year: true, isActive: true } },
      },
      orderBy: { year: 'desc' },
    })
  },

  create(data: {
    firstName: string; lastName: string; gender?: Gender
    ci?: string | null; rude?: string | null; birthDate?: Date | null
    phone?: string | null; email?: string | null; address?: string | null
    kardex?: string | null; userId: number
  }) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.student.create({
      data: { ...data, isActive: true, schoolId: getTenantContext()?.schoolId ?? 0 },
      include: { user: { select: { id: true, email: true, role: true } } },
    })
  },

  update(id: number, data: Prisma.StudentUpdateInput) {
    return prisma.student.update({
      where: { id },
      data,
      include: { user: { select: { id: true, email: true, role: true } } },
    })
  },

  setActive(id: number, isActive: boolean) {
    return prisma.student.update({ where: { id }, data: { isActive } })
  },

  linkUser(id: number, userId: number) {
    return prisma.student.update({ where: { id }, data: { userId } })
  },

  countAssignments(id: number) {
    return prisma.student.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    })
  },

  async deleteRelatedRecords(studentId: number) {
    await prisma.taskSubmission.deleteMany({ where: { studentId } })
    await prisma.nota.deleteMany({ where: { studentId } })
    await prisma.charge.deleteMany({ where: { studentId } })
    await prisma.parentStudent.deleteMany({ where: { studentId } })
  },

  async unlinkUser(id: number) {
    await prisma.$executeRaw`UPDATE "Student" SET "userId" = NULL WHERE id = ${id}`
  },

  delete(id: number) {
    return prisma.student.delete({ where: { id } })
  },

  // ── Inscripciones ────────────────────────────
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  findEnrollment(studentId: number, academicYearId: number, educationType: EducationType) {
    return prisma.studentAcademicAssignment.findUnique({
      where: { studentId_academicYearId_educationType: { studentId, academicYearId, educationType } },
    })
  },

  findEnrollmentForYear(studentId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findFirst({
      where: { studentId, academicYearId },
      include: { course: true },
    })
  },

  createEnrollment(data: { studentId: number; courseId: number; academicYearId: number; educationType: EducationType; year: number }) {
    return prisma.studentAcademicAssignment.create({
      data,
      include: { course: true, academicYear: { select: { year: true } } },
    })
  },

  deleteEnrollmentsForYear(studentId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.deleteMany({ where: { studentId, academicYearId } })
  },

  deleteEnrollmentById(id: number) {
    return prisma.studentAcademicAssignment.delete({ where: { id } })
  },

  findByCourseInYear(courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            ci: true, rude: true, gender: true, isActive: true,
            parents: {
              where: { isTutor: true },
              include: {
                parent: { select: { id: true, firstName: true, lastName: true, phone: true, ci: true } },
              },
            },
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    })
  },

  // ── Autoservicio del estudiante ───────────────
  findProfileByUserId(userId: number | undefined) {
    return prisma.student.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { academicYear: { isActive: true } },
          include: {
            course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
            academicYear: { select: { id: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        parents: {
          where: { isTutor: true },
          include: { parent: { select: { firstName: true, lastName: true, phone: true } } },
          take: 1,
        },
      },
    })
  },

  findActiveAssignmentByUserId(userId: number | undefined) {
    return prisma.student.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { academicYear: { isActive: true } },
          include: {
            course: { select: { id: true, grade: true, parallel: true, level: true, shift: true, educationType: true } },
            academicYear: { select: { id: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  },

  findTutorIdByUserId(userId: number | undefined) {
    return prisma.student.findUnique({
      where: { userId },
      include: { parents: { where: { isTutor: true }, select: { parentId: true }, take: 1 } },
    })
  },

  findTrimestersByAcademicYear(academicYearId: number) {
    return prisma.trimester.findMany({ where: { academicYearId }, orderBy: { number: 'asc' } })
  },

  findNotasDetailed(studentId: number, courseId: number, trimesterIds: number[]) {
    return prisma.nota.findMany({
      where: { studentId, courseId, trimesterId: { in: trimesterIds } },
      include: {
        subject: { select: { id: true, name: true, campo: true } },
        trimester: { select: { id: true, number: true, name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { trimester: { number: 'asc' } }],
    })
  },

  findNotasLean(studentId: number, courseId: number, trimesterIds: number[]) {
    return prisma.nota.findMany({
      where: { studentId, courseId, trimesterId: { in: trimesterIds } },
      select: { subjectId: true, trimesterId: true, total: true },
    })
  },

  findTasksForCourse(courseId: number, academicYearId: number, studentId: number) {
    return prisma.task.findMany({
      where: { courseId, trimester: { academicYearId } },
      include: {
        subject: { select: { id: true, name: true, campo: true } },
        teacher: { select: { firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
        submissions: {
          where: { studentId },
          select: { id: true, score: true, status: true, note: true, submittedAt: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findTeacherSubjectsByCourse(courseId: number, grade: string, educationType: EducationType) {
    return prisma.teacherSubjectCourse.findMany({
      where: { courseId },
      include: {
        subject: {
          select: {
            id: true, name: true, campo: true,
            gradeConfigs: {
              where: { grade: grade as any, educationType },
              select: { hoursPerWeek: true },
            },
          },
        },
        teacher: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    })
  },

  findNotaById(id: number) {
    return prisma.nota.findUnique({ where: { id } })
  },

  updateNotaAutoEvaluacion(id: number, autoEvaluacion: number, total: number | null) {
    return prisma.nota.update({ where: { id }, data: { autoEvaluacion, total } })
  },

  findTrimesterById(id: number) {
    return prisma.trimester.findUnique({ where: { id } })
  },

  findNotificationsByParentId(parentId: number) {
    return prisma.notification.findMany({
      where: { parentId },
      include: { sentBy: { select: { teacher: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  findNotificationForParent(id: number, parentId: number) {
    return prisma.notification.findFirst({ where: { id, parentId } })
  },

  markNotificationRead(id: number) {
    return prisma.notification.update({ where: { id }, data: { isRead: true } })
  },

  // ── Importación de tutores ────────────────────
  findParentsByNameFragment(fragment: string) {
    return prisma.parent.findMany({
      where: {
        OR: [
          { lastName:  { contains: fragment, mode: 'insensitive' } },
          { firstName: { contains: fragment, mode: 'insensitive' } },
        ],
      },
    })
  },

  clearTutorFlag(studentId: number) {
    return prisma.parentStudent.updateMany({ where: { studentId, isTutor: true }, data: { isTutor: false } })
  },

  findParentStudentLink(parentId: number, studentId: number) {
    return prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } })
  },

  setTutorFlag(parentId: number, studentId: number) {
    return prisma.parentStudent.update({
      where: { parentId_studentId: { parentId, studentId } },
      data:  { isTutor: true },
    })
  },

  createTutorLink(parentId: number, studentId: number) {
    return prisma.parentStudent.create({
      data: { parentId, studentId, relationType: 'TUTOR_LEGAL', isTutor: true },
    })
  },
}

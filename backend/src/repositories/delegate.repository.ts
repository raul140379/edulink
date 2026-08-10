import prisma from '../lib/prisma'

export const delegateRepository = {
  // Confirma si alguno de estos estudiantes está matriculado en `courseId`
  // durante `academicYearId` — usado por assertDelegateOwnsParent para
  // verificar que un tutor pertenece al curso del delegado que actúa.
  findAssignmentInCourse(studentIds: number[], courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findFirst({
      where: { studentId: { in: studentIds }, courseId, academicYearId },
    })
  },

  // Todos los tutores (parentId, deduplicado) de los estudiantes matriculados
  // en un curso — usado para acotar las lecturas agregadas de Tesorería
  // (summary/parents/by-course) al curso propio de un DELEGATE.
  async findTutorParentIdsForCourse(courseId: number, academicYearId: number): Promise<number[]> {
    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      include: { student: { include: { parents: { where: { isTutor: true }, select: { parentId: true } } } } },
    })
    const ids = new Set<number>()
    for (const a of assignments) for (const ps of a.student.parents) ids.add(ps.parentId)
    return Array.from(ids)
  },

  findAllCoursesWithDelegateInfo() {
    return prisma.course.findMany({
      include: {
        delegate: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, phone: true,
            delegateUserId: true,
            delegateUser: { select: { id: true, email: true, role: true, isActive: true } },
            user: { select: { id: true, email: true, role: true, isActive: true } },
            students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
          },
        },
        tutor: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }],
    })
  },

  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findAssignmentsWithTutorParents(courseId: number, academicYearId: number) {
    return prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId },
      include: {
        student: {
          include: {
            parents: {
              include: {
                parent: {
                  select: {
                    id: true, firstName: true, lastName: true, ci: true, phone: true,
                    delegateUserId: true,
                    delegateUser: { select: { id: true, email: true, role: true } },
                    user: { select: { id: true, email: true, role: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
  },

  findCourseById(id: number) {
    return prisma.course.findUnique({ where: { id } })
  },

  findParentById(id: number) {
    return prisma.parent.findUnique({ where: { id } })
  },

  findStudentInCourseForParent(courseId: number, academicYearId: number, parentId: number) {
    return prisma.studentAcademicAssignment.findFirst({
      where: { courseId, academicYearId, student: { parents: { some: { parentId } } } },
    })
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  createDelegateUser(email: string, hashedPassword: string) {
    return prisma.user.create({ data: { email, password: hashedPassword, role: 'DELEGATE', isActive: true } })
  },

  linkDelegateUserToParent(parentId: number, delegateUserId: number) {
    return prisma.parent.update({ where: { id: parentId }, data: { delegateUserId } })
  },

  assignDelegateToCourse(courseId: number, parentId: number) {
    return prisma.course.update({
      where: { id: courseId },
      data: { delegateId: parentId },
      include: { delegate: { select: { id: true, firstName: true, lastName: true } } },
    })
  },

  findCourseWithDelegate(courseId: number) {
    return prisma.course.findUnique({ where: { id: courseId }, include: { delegate: true } })
  },

  unlinkDelegateUser(parentId: number) {
    return prisma.parent.update({ where: { id: parentId }, data: { delegateUserId: null } })
  },

  deleteUser(userId: number) {
    return prisma.user.delete({ where: { id: userId } })
  },

  removeDelegateFromCourse(courseId: number) {
    return prisma.course.update({ where: { id: courseId }, data: { delegateId: null } })
  },

  findParentByDelegateUserId(userId: number | undefined) {
    return prisma.parent.findFirst({
      where: { delegateUserId: userId },
      include: {
        delegateCourse: {
          include: {
            assignments: {
              where: { academicYear: { isActive: true } },
              include: {
                student: {
                  select: {
                    id: true, firstName: true, lastName: true, ci: true, rude: true, isActive: true,
                    parents: {
                      include: {
                        parent: {
                          select: {
                            id: true, firstName: true, lastName: true, phone: true,
                            charges: { where: { status: { not: 'ANULADO' } }, select: { amount: true, paidAmount: true, status: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            tutor: { include: { teacher: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    })
  },
}

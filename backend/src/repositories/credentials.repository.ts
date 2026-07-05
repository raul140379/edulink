import prisma from '../lib/prisma'

const EXCLUDED = ['SUPER_ADMIN', 'DIRECTOR', 'JUNTA_ESCOLAR']

export const credentialsRepository = {
  findActiveStudentsForReset() {
    return prisma.student.findMany({
      where: {
        isActive: true,
        userId: { not: null },
        user: { role: { notIn: EXCLUDED as any } },
      },
      include: {
        user: { select: { id: true, email: true } },
        assignments: {
          where: { academicYear: { isActive: true } },
          include: { course: { select: { grade: true, parallel: true, level: true, shift: true } } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  },

  findParentsForReset() {
    return prisma.parent.findMany({
      where: {
        userId: { not: null },
        user: { role: { notIn: EXCLUDED as any } },
      },
      include: {
        user: { select: { id: true, email: true } },
        students: {
          where: { isTutor: true },
          include: {
            student: {
              select: {
                firstName: true, lastName: true,
                assignments: {
                  where: { academicYear: { isActive: true } },
                  include: { course: { select: { grade: true, parallel: true, shift: true } } },
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
          take: 5,
        },
      },
    })
  },

  findActiveTeachersForReset() {
    return prisma.teacher.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, email: true, role: true } },
        tutorUser: { select: { id: true, email: true, role: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  },

  findOtherRoleUsersForReset(roles: string[]) {
    return prisma.user.findMany({
      where: { role: { in: roles as any }, isActive: true },
      include: {
        parent: { select: { firstName: true, lastName: true, ci: true, phone: true } },
        parentDelegate: { select: { firstName: true, lastName: true, ci: true, phone: true } },
        staff: { select: { firstName: true, lastName: true, ci: true, phone: true, staffRole: true } },
      },
      orderBy: [{ role: 'asc' }],
    })
  },

  updateUserPassword(userId: number, hashedPassword: string) {
    return prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } })
  },
}

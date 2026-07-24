import { Prisma, RelationType } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const parentRepository = {
  findMany(where: Prisma.ParentWhereInput) {
    return prisma.parent.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          select: {
            relationType: true,
            isTutor: true,
            student: { select: { id: true, firstName: true, lastName: true, ci: true, rude: true, kardex: true } },
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  },

  findById(id: number) {
    return prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true, ci: true, rude: true, birthDate: true,
                assignments: {
                  include: { course: true, academicYear: { select: { year: true, isActive: true } } },
                  orderBy: { year: 'desc' }, take: 1,
                },
              },
            },
          },
        },
        charges: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
  },

  findRaw(id: number) {
    return prisma.parent.findUnique({ where: { id } })
  },

  findByCI(ci: string) {
    return prisma.parent.findFirst({ where: { ci } })
  },

  findByNameFragment(firstName: string, lastName: string) {
    return prisma.parent.findFirst({
      where: {
        firstName: { contains: firstName, mode: 'insensitive' },
        lastName:  { contains: lastName, mode: 'insensitive' },
      },
    })
  },

  findStudentRelations(parentId: number) {
    return prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, rude: true, isActive: true,
            assignments: {
              include: { course: true, academicYear: { select: { year: true, isActive: true } } },
              orderBy: { year: 'desc' }, take: 1,
            },
          },
        },
      },
    })
  },

  create(data: Prisma.ParentCreateInput) {
    return prisma.parent.create({ data })
  },

  update(id: number, data: Prisma.ParentUpdateInput) {
    return prisma.parent.update({ where: { id }, data, include: { user: { select: { id: true, email: true, role: true } } } })
  },

  findWithStudentsCount(id: number) {
    return prisma.parent.findUnique({ where: { id }, include: { _count: { select: { students: true } } } })
  },

  findWithFullDetail(id: number) {
    return prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
        students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    })
  },

  setUserActive(userId: number, isActive: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { isActive } })
  },

  linkUser(id: number, userId: number) {
    return prisma.parent.update({ where: { id }, data: { userId } })
  },

  countOtherTutorsFor(studentId: number, excludeParentId: number) {
    return prisma.parentStudent.count({ where: { studentId, isTutor: true, NOT: { parentId: excludeParentId } } })
  },

  deleteRelations(parentId: number) {
    return prisma.parentStudent.deleteMany({ where: { parentId } })
  },

  async unlinkUser(id: number) {
    await prisma.$executeRaw`UPDATE "Parent" SET "userId" = NULL WHERE id = ${id}`
  },

  delete(id: number) {
    return prisma.parent.delete({ where: { id } })
  },

  findRelation(parentId: number, studentId: number) {
    return prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } })
  },

  createRelation(parentId: number, studentId: number, relationType: RelationType, isTutor: boolean) {
    return prisma.parentStudent.create({
      data: { parentId, studentId, relationType, isTutor },
      include: { student: { select: { firstName: true, lastName: true } } },
    })
  },

  createRelationSimple(parentId: number, studentId: number, relationType: RelationType, isTutor: boolean) {
    return prisma.parentStudent.create({ data: { parentId, studentId, relationType, isTutor } })
  },

  deleteRelation(parentId: number, studentId: number) {
    return prisma.parentStudent.delete({ where: { parentId_studentId: { parentId, studentId } } })
  },

  updateRelation(parentId: number, studentId: number, data: Prisma.ParentStudentUpdateInput) {
    return prisma.parentStudent.update({ where: { parentId_studentId: { parentId, studentId } }, data })
  },

  clearTutorForStudent(studentId: number) {
    return prisma.parentStudent.updateMany({
      where: { studentId, relationType: 'TUTOR_LEGAL' },
      data:  { relationType: 'OTRO', isTutor: false },
    })
  },

  clearAnyTutorForStudent(studentId: number) {
    return prisma.parentStudent.updateMany({
      where: { studentId, isTutor: true },
      data:  { isTutor: false, relationType: 'OTRO' },
    })
  },

  // ── Autoservicio ──────────────────────────────
  findByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({
      where: { userId },
      include: {
        students: {
          include: {
            student: {
              include: { assignments: { include: { course: true, academicYear: { select: { isActive: true, year: true } } } } },
            },
          },
        },
        charges: { where: { status: { not: 'ANULADO' } }, orderBy: { createdAt: 'desc' } },
      },
    })
  },

  findRawByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({ where: { userId } })
  },

  updateProfile(id: number, data: { phone: string | null; email: string | null; address: string | null }) {
    return prisma.parent.update({ where: { id }, data })
  },

  findMyStudentsByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({
      where: { userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                assignments: {
                  where: { academicYear: { isActive: true } },
                  include: {
                    course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
                    academicYear: { select: { year: true } },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })
  },

  // ── Importación ───────────────────────────────
  findStudentsByKardex(kardex: string) {
    return prisma.student.findMany({ where: { kardex } })
  },

  create_simple(data: { firstName: string; lastName: string; ci: string | null; phone: string | null; userId?: number }) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.parent.create({ data: { ...data, schoolId: getTenantContext()?.schoolId ?? 0 } })
  },
}

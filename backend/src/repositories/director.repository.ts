import prisma from '../lib/prisma'

export const directorRepository = {
  findActiveForSchool(schoolId: number) {
    return prisma.director.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true, user: { select: { id: true, email: true } } },
    })
  },

  deactivateAllForSchool(schoolId: number) {
    return prisma.director.updateMany({ where: { schoolId, isActive: true }, data: { isActive: false } })
  },

  create(data: { firstName: string; lastName: string; ci: string | null; phone: string | null; schoolId: number; userId: number }) {
    return prisma.director.create({ data })
  },
}

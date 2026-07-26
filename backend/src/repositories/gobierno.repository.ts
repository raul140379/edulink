import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const gobiernoRepository = {
  findMany() {
    return prisma.gobiernoMember.findMany({
      include: {
        user:     { select: { email: true, isActive: true, role: true } },
        school:   { select: { id: true, name: true } },
        nucleo:   { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.gobiernoMember.findUnique({ where: { id } })
  },

  create(data: Prisma.GobiernoMemberCreateInput) {
    return prisma.gobiernoMember.create({ data })
  },

  update(id: number, data: Prisma.GobiernoMemberUpdateInput) {
    return prisma.gobiernoMember.update({ where: { id }, data })
  },
}

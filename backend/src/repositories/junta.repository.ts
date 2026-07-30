import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const juntaRepository = {
  findMany() {
    return prisma.juntaMember.findMany({
      include: {
        user:     { select: { id: true, email: true, isActive: true, role: true } },
        // school.nucleo es el fallback de agrupamiento: hoy un JuntaMember de tipo
        // JUNTA_ESCOLAR no siempre trae nucleoId propio seteado, pero su colegio sí.
        school:   { select: { id: true, name: true, nucleo: { select: { id: true, name: true } } } },
        nucleo:   { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.juntaMember.findUnique({ where: { id } })
  },

  findByUserId(userId: number) {
    return prisma.juntaMember.findFirst({ where: { userId } })
  },

  create(data: Prisma.JuntaMemberCreateInput) {
    return prisma.juntaMember.create({ data })
  },

  update(id: number, data: Prisma.JuntaMemberUpdateInput) {
    return prisma.juntaMember.update({ where: { id }, data })
  },
}

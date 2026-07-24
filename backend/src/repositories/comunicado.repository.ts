import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

const authorSelect = { author: { select: { id: true, email: true } } } as const

export const comunicadoRepository = {
  findPublished() {
    return prisma.comunicado.findMany({
      where:   { isPublished: true },
      select:  { id: true, title: true, body: true, type: true, imageUrl: true, publishedAt: true, ...authorSelect },
      orderBy: { publishedAt: 'desc' },
    })
  },

  findMany(where: Prisma.ComunicadoWhereInput) {
    return prisma.comunicado.findMany({
      where,
      include: authorSelect,
      orderBy: { publishedAt: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.comunicado.findUnique({ where: { id } })
  },

  create(data: Prisma.ComunicadoCreateInput) {
    return prisma.comunicado.create({ data, include: authorSelect })
  },

  update(id: number, data: Prisma.ComunicadoUpdateInput) {
    return prisma.comunicado.update({ where: { id }, data, include: authorSelect })
  },

  setPublished(id: number, isPublished: boolean) {
    return prisma.comunicado.update({ where: { id }, data: { isPublished } })
  },
}

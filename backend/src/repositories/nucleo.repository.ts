import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const nucleoRepository = {
  findMany(where: Prisma.NucleoWhereInput) {
    return prisma.nucleo.findMany({ where, orderBy: { name: 'asc' } })
  },

  findById(id: number) {
    return prisma.nucleo.findUnique({ where: { id } })
  },

  findByName(name: string, districtId: number) {
    return prisma.nucleo.findFirst({
      where: { districtId, name: { equals: name, mode: 'insensitive' } },
    })
  },

  create(data: Prisma.NucleoCreateInput) {
    return prisma.nucleo.create({ data })
  },

  update(id: number, data: Prisma.NucleoUpdateInput) {
    return prisma.nucleo.update({ where: { id }, data })
  },
}

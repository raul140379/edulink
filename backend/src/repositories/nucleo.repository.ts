import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const nucleoRepository = {
  findMany(where: Prisma.NucleoWhereInput) {
    return prisma.nucleo.findMany({ where, orderBy: { name: 'asc' } })
  },
}

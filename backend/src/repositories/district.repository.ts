import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const districtRepository = {
  findById(id: number) {
    return prisma.district.findUnique({ where: { id } })
  },

  update(id: number, data: Prisma.DistrictUpdateInput) {
    return prisma.district.update({ where: { id }, data })
  },
}

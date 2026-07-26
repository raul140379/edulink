import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const poaActaRepository = {
  findMany() {
    return prisma.poaActa.findMany({ orderBy: { academicYear: 'desc' } })
  },

  findByYear(academicYear: number) {
    return prisma.poaActa.findFirst({ where: { academicYear } })
  },

  // schoolId explícito — usado desde el upsert que llega vía multer (sin
  // contexto de tenant activo, ver poa-acta.service.ts).
  findByYearAndSchool(schoolId: number, academicYear: number) {
    return prisma.poaActa.findFirst({ where: { schoolId, academicYear } })
  },

  create(data: Prisma.PoaActaCreateInput) {
    return prisma.poaActa.create({ data })
  },

  update(id: number, data: Prisma.PoaActaUpdateInput) {
    return prisma.poaActa.update({ where: { id }, data })
  },
}

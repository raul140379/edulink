import { Prisma, Role } from '@prisma/client'
import { nucleoRepository } from '../repositories/nucleo.repository'
import { getTenantContext } from '../lib/tenant-context'

export const nucleoService = {
  async listNucleos() {
    const ctx = getTenantContext()
    const where: Prisma.NucleoWhereInput = {}
    if (ctx?.role === Role.DIRECTOR_DISTRITAL && ctx.districtId != null) {
      where.districtId = ctx.districtId
    }
    return nucleoRepository.findMany(where)
  },
}

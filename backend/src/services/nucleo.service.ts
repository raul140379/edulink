import { Prisma, Role } from '@prisma/client'
import { nucleoRepository } from '../repositories/nucleo.repository'
import { getTenantContext } from '../lib/tenant-context'
import { DISTRICT_WIDE_ROLES, NUCLEO_WIDE_ROLES } from '../lib/scoped-models'
import { HttpError } from '../utils/http-error'
import { CreateNucleoInput, UpdateNucleoInput } from '../schemas/nucleo.schema'

export const nucleoService = {
  async listNucleos() {
    const ctx = getTenantContext()
    const where: Prisma.NucleoWhereInput = {}
    if (DISTRICT_WIDE_ROLES.has(ctx?.role as Role) && ctx?.districtId != null) {
      where.districtId = ctx.districtId
    } else if (NUCLEO_WIDE_ROLES.has(ctx?.role as Role) && ctx?.nucleoId != null) {
      where.id = ctx.nucleoId
    }
    return nucleoRepository.findMany(where)
  },

  async createNucleo(input: CreateNucleoInput) {
    const ctx = getTenantContext()
    if (ctx?.districtId == null) throw new HttpError(400, 'Tu usuario no está vinculado a un distrito')

    const existing = await nucleoRepository.findByName(input.name, ctx.districtId)
    if (existing) throw new HttpError(409, `Ya existe un núcleo llamado "${input.name}" en tu distrito`)

    return nucleoRepository.create({
      name:     input.name,
      location: input.location || null,
      district: { connect: { id: ctx.districtId } },
    })
  },

  async updateNucleo(id: number, input: UpdateNucleoInput) {
    const nucleo = await nucleoRepository.findById(id)
    if (!nucleo) throw new HttpError(404, 'Núcleo no encontrado')

    const ctx = getTenantContext()
    if (ctx?.role === Role.DIRECTOR_DISTRITAL && nucleo.districtId !== ctx.districtId) {
      throw new HttpError(403, 'Este núcleo no pertenece a tu distrito')
    }
    return nucleoRepository.update(id, input)
  },
}

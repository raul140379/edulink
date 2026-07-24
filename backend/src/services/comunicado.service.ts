import { Prisma, Role } from '@prisma/client'
import { comunicadoRepository } from '../repositories/comunicado.repository'
import { getTenantContext } from '../lib/tenant-context'
import { HttpError } from '../utils/http-error'
import { CreateComunicadoInput, UpdateComunicadoInput } from '../schemas/comunicado.schema'

// Comunicado es de alcance distrital (no por colegio), por eso queda fuera de
// DIRECT_SCHOOL_SCOPED_MODELS/DUAL_SCOPED_MODELS en lib/scoped-models.ts — el
// filtrado por distrito se resuelve acá a mano, igual que Notification.sentById.
export const comunicadoService = {
  async listComunicados() {
    const ctx = getTenantContext()
    const where: Prisma.ComunicadoWhereInput = {}
    if (ctx?.role === Role.DIRECTOR_DISTRITAL && ctx.districtId != null) {
      where.districtId = ctx.districtId
    }
    return comunicadoRepository.findMany(where)
  },

  async createComunicado(input: CreateComunicadoInput) {
    const ctx = getTenantContext()
    if (!ctx?.userId || ctx.districtId == null) {
      throw new HttpError(400, 'Solo el Director Distrital puede publicar comunicados')
    }
    return comunicadoRepository.create({
      title:    input.title,
      body:     input.body,
      type:     input.type,
      imageUrl: input.imageUrl || null,
      author:   { connect: { id: ctx.userId } },
      district: { connect: { id: ctx.districtId } },
    })
  },

  async updateComunicado(id: number, input: UpdateComunicadoInput) {
    await comunicadoService.assertOwnedByDistrict(id)
    return comunicadoRepository.update(id, input)
  },

  async deleteComunicado(id: number) {
    await comunicadoService.assertOwnedByDistrict(id)
    await comunicadoRepository.setPublished(id, false)
  },

  async assertOwnedByDistrict(id: number) {
    const comunicado = await comunicadoRepository.findById(id)
    if (!comunicado) throw new HttpError(404, 'Comunicado no encontrado')

    const ctx = getTenantContext()
    if (ctx?.role === Role.DIRECTOR_DISTRITAL && comunicado.districtId !== ctx.districtId) {
      throw new HttpError(403, 'Este comunicado no pertenece a tu distrito')
    }
    return comunicado
  },
}

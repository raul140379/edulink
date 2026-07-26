import { Prisma, Role } from '@prisma/client'
import { comunicadoRepository } from '../repositories/comunicado.repository'
import { schoolRepository } from '../repositories/school.repository'
import { nucleoRepository } from '../repositories/nucleo.repository'
import { getTenantContext } from '../lib/tenant-context'
import { DISTRICT_WIDE_ROLES, NUCLEO_WIDE_ROLES } from '../lib/scoped-models'
import { HttpError } from '../utils/http-error'
import { CreateComunicadoInput, UpdateComunicadoInput } from '../schemas/comunicado.schema'

// Comunicado es un "broadcast hacia abajo en la jerarquía" (distrito -> núcleo ->
// colegio), no una fila aislada por tenant, por eso queda fuera de
// DIRECT_SCHOOL_SCOPED_MODELS/TENANT_SCOPED_MODELS en lib/scoped-models.ts — el
// filtrado se resuelve acá a mano, igual que Notification.sentById.
export const comunicadoService = {
  async listComunicados() {
    const ctx = getTenantContext()
    if (!ctx) return comunicadoRepository.findMany({})

    // Alcance distrital (Director Distrital, Junta/Gobierno de Distrito): ve todo
    // lo publicado en su distrito, sin importar en qué núcleo/colegio se acotó.
    if (DISTRICT_WIDE_ROLES.has(ctx.role) && ctx.districtId != null) {
      return comunicadoRepository.findMany({ districtId: ctx.districtId })
    }

    // Alcance de núcleo (Junta/Gobierno de Núcleo): lo de su núcleo + lo distrital.
    if (NUCLEO_WIDE_ROLES.has(ctx.role) && ctx.nucleoId != null) {
      const where: Prisma.ComunicadoWhereInput = {
        OR: [{ nucleoId: ctx.nucleoId }, { AND: [{ schoolId: null }, { nucleoId: null }] }],
      }
      return comunicadoRepository.findMany(where)
    }

    // Alcance de colegio (todos los demás roles con schoolId): lo de su colegio + lo distrital.
    if (ctx.schoolId != null) {
      const where: Prisma.ComunicadoWhereInput = {
        OR: [{ schoolId: ctx.schoolId }, { AND: [{ schoolId: null }, { nucleoId: null }] }],
      }
      return comunicadoRepository.findMany(where)
    }

    return comunicadoRepository.findMany({})
  },

  async createComunicado(input: CreateComunicadoInput) {
    const ctx = getTenantContext()
    if (!ctx?.userId) throw new HttpError(400, 'No autenticado')

    const base = {
      title:    input.title,
      body:     input.body,
      type:     input.type,
      imageUrl: input.imageUrl || null,
      author:   { connect: { id: ctx.userId } },
    }

    if (DISTRICT_WIDE_ROLES.has(ctx.role) && ctx.districtId != null) {
      return comunicadoRepository.create({ ...base, district: { connect: { id: ctx.districtId } } })
    }

    if (NUCLEO_WIDE_ROLES.has(ctx.role) && ctx.nucleoId != null) {
      const nucleo = await nucleoRepository.findById(ctx.nucleoId)
      if (!nucleo) throw new HttpError(400, 'Núcleo no encontrado')
      return comunicadoRepository.create({
        ...base,
        district: { connect: { id: nucleo.districtId } },
        nucleo:   { connect: { id: ctx.nucleoId } },
      })
    }

    if (ctx.schoolId != null) {
      const school = await schoolRepository.findById(ctx.schoolId)
      if (!school) throw new HttpError(400, 'Colegio no encontrado')
      return comunicadoRepository.create({
        ...base,
        district: { connect: { id: school.districtId } },
        school:   { connect: { id: ctx.schoolId } },
      })
    }

    throw new HttpError(400, 'Tu usuario no está vinculado a un distrito, núcleo o colegio')
  },

  async updateComunicado(id: number, input: UpdateComunicadoInput) {
    await comunicadoService.assertOwnedByScope(id)
    return comunicadoRepository.update(id, input)
  },

  async deleteComunicado(id: number) {
    await comunicadoService.assertOwnedByScope(id)
    await comunicadoRepository.setPublished(id, false)
  },

  async assertOwnedByScope(id: number) {
    const comunicado = await comunicadoRepository.findById(id)
    if (!comunicado) throw new HttpError(404, 'Comunicado no encontrado')

    const ctx = getTenantContext()
    if (ctx?.role === Role.SUPER_ADMIN) return comunicado

    if (DISTRICT_WIDE_ROLES.has(ctx?.role as Role) && comunicado.districtId !== ctx?.districtId) {
      throw new HttpError(403, 'Este comunicado no pertenece a tu distrito')
    }
    if (NUCLEO_WIDE_ROLES.has(ctx?.role as Role) && comunicado.nucleoId !== ctx?.nucleoId) {
      throw new HttpError(403, 'Este comunicado no pertenece a tu núcleo')
    }
    if (ctx?.schoolId != null && comunicado.schoolId !== ctx.schoolId) {
      throw new HttpError(403, 'Este comunicado no pertenece a tu colegio')
    }
    return comunicado
  },
}

import { Prisma, Role } from '@prisma/client'
import { schoolRepository } from '../repositories/school.repository'
import { getTenantContext } from '../lib/tenant-context'
import { HttpError } from '../utils/http-error'
import { CreateSchoolInput, UpdateSchoolInput } from '../schemas/school.schema'

export const schoolService = {
  async listSchools() {
    const ctx = getTenantContext()
    const where: Prisma.SchoolWhereInput = {}

    // SUPER_ADMIN sees every school in every district. DIRECTOR_DISTRITAL sees
    // only the schools inside their own district. (Any other role never reaches
    // this service — the route is gated by SCHOOL_VIEW_ALL.)
    if (ctx?.role === Role.DIRECTOR_DISTRITAL && ctx.districtId != null) {
      where.districtId = ctx.districtId
    }

    return schoolRepository.findMany(where)
  },

  async getSchoolById(id: number) {
    const school = await schoolRepository.findById(id)
    if (!school) throw new HttpError(404, 'Unidad educativa no encontrada')

    const ctx = getTenantContext()
    if (ctx?.role === Role.DIRECTOR_DISTRITAL && school.districtId !== ctx.districtId) {
      throw new HttpError(403, 'Esta unidad educativa no pertenece a tu distrito')
    }
    return school
  },

  async createSchool(input: CreateSchoolInput) {
    const existing = await schoolRepository.findBySieCode(input.sieCode)
    if (existing) throw new HttpError(409, `Ya existe una unidad educativa con el SIE ${input.sieCode}`)

    const ctx = getTenantContext()
    const districtId = ctx?.role === Role.DIRECTOR_DISTRITAL ? ctx.districtId : input.districtId
    if (!districtId) throw new HttpError(400, 'Falta indicar el distrito')

    const district = await schoolRepository.findDistrictById(districtId)
    if (!district) throw new HttpError(404, 'Distrito no encontrado')

    return schoolRepository.create({
      name:    input.name,
      sieCode: input.sieCode,
      tipo:    input.tipo,
      area:    input.area,
      address: input.address || null,
      district: { connect: { id: districtId } },
      ...(input.nucleoId != null ? { nucleo: { connect: { id: input.nucleoId } } } : {}),
    })
  },

  async updateSchool(id: number, input: UpdateSchoolInput) {
    await schoolService.getSchoolById(id) // 404/403 guard, respects district scope
    return schoolRepository.update(id, input)
  },
}

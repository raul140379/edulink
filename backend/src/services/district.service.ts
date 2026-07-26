import { districtRepository } from '../repositories/district.repository'
import { getTenantContext } from '../lib/tenant-context'
import { HttpError } from '../utils/http-error'
import { UpdateDistrictInput } from '../schemas/district.schema'

const MAX_LOGO_BYTES = 300 * 1024 // 300KB — el logo se guarda como base64 en la BD, no en disco

export const districtService = {
  async getMyDistrict() {
    const ctx = getTenantContext()
    if (ctx?.districtId == null) throw new HttpError(400, 'Tu usuario no está vinculado a un distrito')
    const district = await districtRepository.findById(ctx.districtId)
    if (!district) throw new HttpError(404, 'Distrito no encontrado')
    return district
  },

  async updateMyDistrict(input: UpdateDistrictInput) {
    const ctx = getTenantContext()
    if (ctx?.districtId == null) throw new HttpError(400, 'Tu usuario no está vinculado a un distrito')
    return districtRepository.update(ctx.districtId, input)
  },

  // districtId explícito (de req.userDistrictId, no de getTenantContext()) por la
  // misma razón que schoolService.importSchools: el contexto de AsyncLocalStorage
  // no se propaga de forma confiable a través del middleware de multer.
  async updateMyDistrictLogo(file: Express.Multer.File | undefined, districtId: number | null | undefined) {
    if (!file) throw new HttpError(400, 'No se recibió ningún archivo')
    if (!file.mimetype.startsWith('image/')) throw new HttpError(400, 'El archivo debe ser una imagen')
    if (file.size > MAX_LOGO_BYTES) throw new HttpError(400, `La imagen no puede superar ${MAX_LOGO_BYTES / 1024}KB`)
    if (districtId == null) throw new HttpError(400, 'Tu usuario no está vinculado a un distrito')

    const logoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
    return districtRepository.update(districtId, { logoUrl })
  },
}

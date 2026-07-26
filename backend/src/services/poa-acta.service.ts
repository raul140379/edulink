import { poaActaRepository } from '../repositories/poa-acta.repository'
import { HttpError } from '../utils/http-error'
import { UpsertPoaActaInput } from '../schemas/poa-acta.schema'

const MAX_ACTA_BYTES = 5 * 1024 * 1024 // 5MB — el acta puede ser un PDF escaneado

export const poaActaService = {
  // Listado gateado por CHARGE_VIEW_ALL — el motor de tenant-scoping ya filtra
  // al colegio (Junta Escolar) o distrito (Director Distrital) del que consulta.
  listPoaActas() {
    return poaActaRepository.findMany()
  },

  // schoolId/userId explícitos (de req.userSchoolId/req.userId, NO de
  // getTenantContext()) por la misma razón que districtService.updateMyDistrictLogo
  // y schoolService.importSchools: el AsyncLocalStorage del contexto de tenant no
  // se propaga de forma confiable a través del middleware de multer en rutas con
  // upload de archivos.
  async upsertMyPoaActa(
    input: UpsertPoaActaInput,
    file: Express.Multer.File | undefined,
    schoolId: number | null | undefined,
    userId: number | undefined,
  ) {
    if (schoolId == null) throw new HttpError(400, 'Tu usuario no está vinculado a un colegio')
    if (!userId) throw new HttpError(401, 'No autenticado')

    let actaFileUrl: string | undefined
    if (file) {
      if (file.size > MAX_ACTA_BYTES) throw new HttpError(400, `El archivo no puede superar ${MAX_ACTA_BYTES / (1024 * 1024)}MB`)
      actaFileUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
    }

    const existing = await poaActaRepository.findByYearAndSchool(schoolId, input.academicYear)

    if (existing) {
      return poaActaRepository.update(existing.id, {
        assemblyDate:    new Date(input.assemblyDate),
        montoGlobal:     input.montoGlobal,
        montoIndividual: input.montoIndividual ?? null,
        items:           input.items,
        ...(actaFileUrl ? { actaFileUrl } : {}),
      })
    }

    if (!actaFileUrl) throw new HttpError(400, 'Debes adjuntar el archivo escaneado del acta')

    return poaActaRepository.create({
      academicYear:    input.academicYear,
      assemblyDate:    new Date(input.assemblyDate),
      montoGlobal:     input.montoGlobal,
      montoIndividual: input.montoIndividual ?? null,
      items:           input.items,
      actaFileUrl,
      school:    { connect: { id: schoolId } },
      createdBy: { connect: { id: userId } },
    })
  },
}

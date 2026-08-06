import { mandatoryChargeRepository } from '../repositories/mandatoryCharge.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CreateMandatoryChargeInput } from '../schemas/treasury.schema'

export const mandatoryChargeService = {
  list() {
    const schoolId = getTenantContext()?.schoolId ?? 0
    return mandatoryChargeRepository.findAll(schoolId)
  },

  async create(input: CreateMandatoryChargeInput) {
    const schoolId = getTenantContext()?.schoolId ?? 0
    const mandatoryCharge = await mandatoryChargeRepository.create({
      title: input.title,
      description: input.description || null,
      amount: input.amount,
      type: input.type,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      academicYearId: input.academicYearId,
      schoolId,
    })

    // Se aplica de inmediato a todos los tutores actuales que aún no la
    // tengan — cubre tanto "al inicio de gestión" (todos la reciben) como
    // "en el transcurso de la gestión" (solo faltaba para los nuevos).
    const applied = await this.applyToMissing(mandatoryCharge.id)

    return { mandatoryCharge, appliedCount: applied.appliedCount }
  },

  async toggle(id: number) {
    const existing = await mandatoryChargeRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Cargo obligatorio no encontrado')
    return mandatoryChargeRepository.toggle(id, !existing.isActive)
  },

  // Busca tutores del colegio sin este cargo y se lo crea — el botón único
  // "buscar y aplicar a faltantes" pedido por Junta Escolar.
  async applyToMissing(mandatoryChargeId: number) {
    const template = await mandatoryChargeRepository.findById(mandatoryChargeId)
    if (!template) throw new HttpError(404, 'Cargo obligatorio no encontrado')

    const missing = await mandatoryChargeRepository.findTutorsMissingCharge(template.schoolId, mandatoryChargeId)
    if (missing.length === 0) return { appliedCount: 0 }

    await mandatoryChargeRepository.createChargesForParents(
      mandatoryChargeId, missing.map((p) => p.id),
      {
        title: template.title, amount: template.amount, type: template.type,
        dueDate: template.dueDate, academicYearId: template.academicYearId, schoolId: template.schoolId,
      },
    )
    return { appliedCount: missing.length }
  },

  // Enganchado desde parentService.createParent cuando un tutor nuevo se
  // registra — le crea el cargo de toda plantilla activa de la gestión
  // activa que todavía no tenga (normalmente ninguna, por ser recién creado).
  async applyActiveTemplatesToTutor(parentId: number) {
    const schoolId = getTenantContext()?.schoolId ?? 0
    const activeYear = await mandatoryChargeRepository.findActiveAcademicYear()
    if (!activeYear) return

    const templates = await mandatoryChargeRepository.findActiveForYear(schoolId, activeYear.id)
    for (const template of templates) {
      const missing = await mandatoryChargeRepository.findTutorsMissingCharge(schoolId, template.id, parentId)
      if (missing.length === 0) continue
      await mandatoryChargeRepository.createChargesForParents(
        template.id, [parentId],
        { title: template.title, amount: template.amount, type: template.type, dueDate: template.dueDate, academicYearId: template.academicYearId, schoolId },
      )
    }
  },
}

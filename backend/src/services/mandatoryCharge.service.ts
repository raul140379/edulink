import prisma from '../lib/prisma'
import { mandatoryChargeRepository } from '../repositories/mandatoryCharge.repository'
import { auditLogRepository } from '../repositories/auditLog.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CreateMandatoryChargeInput, UpdateMandatoryChargeInput } from '../schemas/treasury.schema'

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

  // Edita solo la plantilla (título/monto/tipo/vencimiento/descripción) — no
  // toca retroactivamente los cargos ya generados a partir de ella, esos
  // quedan con el valor que tenían al crearse (mismo criterio que
  // treasuryService.updateCharge sobre un cargo individual).
  async update(id: number, input: UpdateMandatoryChargeInput) {
    const existing = await mandatoryChargeRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Cargo obligatorio no encontrado')

    return mandatoryChargeRepository.update(id, {
      ...(input.title       !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.amount      !== undefined ? { amount: input.amount } : {}),
      ...(input.type        !== undefined ? { type: input.type } : {}),
      ...(input.dueDate     !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
    })
  },

  async toggle(id: number) {
    const existing = await mandatoryChargeRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Cargo obligatorio no encontrado')
    return mandatoryChargeRepository.toggle(id, !existing.isActive)
  },

  // Borrado permanente de la plantilla y de todo cargo que generó — para el
  // caso de una plantilla creada por error (ej. mal-etiquetada bajo la
  // gestión equivocada) que nunca debió existir. Si algún cargo generado ya
  // tiene un pago real registrado, se avisa explícitamente en vez de borrarlo
  // en silencio — quien confirma decide si de verdad quiere perder ese pago.
  async remove(id: number, confirmDespiteExistingPayments = false) {
    const existing = await mandatoryChargeRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Cargo obligatorio no encontrado')

    const withPayments = await mandatoryChargeRepository.countChargesWithPayments(id)
    if (withPayments > 0 && !confirmDespiteExistingPayments) {
      throw new HttpError(409, `${withPayments} de los cargos generados ya tienen un pago registrado — confirmá de nuevo si igual querés borrar todo, incluidos esos pagos`)
    }

    // Foto de todo lo que se va a perder ANTES de borrar — es la única forma
    // de poder reconstruirlo después (ver CLAUDE.md 17.1).
    const snapshot = await mandatoryChargeRepository.findSnapshotForDelete(id)
    const ctx = getTenantContext()

    return prisma.$transaction(async (tx) => {
      await mandatoryChargeRepository.deletePaymentsTx(tx, id)
      const { count } = await mandatoryChargeRepository.deleteChargesTx(tx, id)
      await mandatoryChargeRepository.deleteTemplateTx(tx, id)
      await auditLogRepository.create({
        action: 'DELETE', entityType: 'MandatoryCharge', entityId: id,
        before: snapshot ?? undefined,
        actorUserId: ctx?.userId ?? null, schoolId: existing.schoolId,
      }, tx)
      return { chargesDeleted: count }
    })
  },

  // Busca tutores del colegio sin este cargo y se lo crea — el botón único
  // "buscar y aplicar a faltantes" pedido por Junta Escolar.
  async applyToMissing(mandatoryChargeId: number) {
    const template = await mandatoryChargeRepository.findById(mandatoryChargeId)
    if (!template) throw new HttpError(404, 'Cargo obligatorio no encontrado')

    const missing = await mandatoryChargeRepository.findTutorsMissingCharge(template.schoolId, mandatoryChargeId, template.academicYearId)
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
      const missing = await mandatoryChargeRepository.findTutorsMissingCharge(schoolId, template.id, template.academicYearId, parentId)
      if (missing.length === 0) continue
      await mandatoryChargeRepository.createChargesForParents(
        template.id, [parentId],
        { title: template.title, amount: template.amount, type: template.type, dueDate: template.dueDate, academicYearId: template.academicYearId, schoolId },
      )
    }
  },
}

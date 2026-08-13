import prisma from '../lib/prisma'

export const mandatoryChargeRepository = {
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findAll(schoolId: number) {
    return prisma.mandatoryCharge.findMany({
      where: { schoolId },
      include: { academicYear: { select: { id: true, year: true } }, _count: { select: { charges: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.mandatoryCharge.findUnique({ where: { id } })
  },

  create(data: { title: string; description: string | null; amount: number; type: any; dueDate: Date | null; academicYearId: number; schoolId: number }) {
    return prisma.mandatoryCharge.create({ data })
  },

  toggle(id: number, isActive: boolean) {
    return prisma.mandatoryCharge.update({ where: { id }, data: { isActive } })
  },

  update(id: number, data: Partial<{ title: string; description: string | null; amount: number; type: any; dueDate: Date | null }>) {
    return prisma.mandatoryCharge.update({ where: { id }, data })
  },

  findActiveForYear(schoolId: number, academicYearId: number) {
    return prisma.mandatoryCharge.findMany({ where: { schoolId, academicYearId, isActive: true } })
  },

  // Tutores del colegio (cualquier relación isTutor:true) que TODAVÍA no
  // tienen un Charge generado desde esta plantilla — la base tanto de
  // "aplicar a faltantes" como de la aplicación automática a un tutor nuevo.
  findTutorsMissingCharge(schoolId: number, mandatoryChargeId: number, onlyParentId?: number) {
    return prisma.parent.findMany({
      where: {
        schoolId,
        students: { some: { isTutor: true } },
        charges: { none: { mandatoryChargeId } },
        ...(onlyParentId ? { id: onlyParentId } : {}),
      },
      select: { id: true },
    })
  },

  createChargesForParents(mandatoryChargeId: number, parentIds: number[], data: { title: string; amount: number; type: any; dueDate: Date | null; academicYearId: number; schoolId: number }) {
    return prisma.charge.createMany({
      data: parentIds.map((parentId) => ({ ...data, parentId, mandatoryChargeId, target: 'TUTOR' as const })),
    })
  },

  countChargesWithPayments(mandatoryChargeId: number) {
    return prisma.charge.count({ where: { mandatoryChargeId, payments: { some: {} } } })
  },

  // Borra la plantilla Y todo lo que generó — a diferencia de toggle
  // (desactivar), esto es permanente: se usa para el caso de una plantilla
  // creada por error que nunca debió aplicarse (ver "Aporte BTH 2025"
  // mal-etiquetada bajo la gestión equivocada). Primero los Payment de esos
  // Charge (si hubiera), después los Charge, después la plantilla.
  async deleteWithCharges(mandatoryChargeId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { charge: { mandatoryChargeId } } })
      const { count } = await tx.charge.deleteMany({ where: { mandatoryChargeId } })
      await tx.mandatoryCharge.delete({ where: { id: mandatoryChargeId } })
      return { chargesDeleted: count }
    })
  },
}

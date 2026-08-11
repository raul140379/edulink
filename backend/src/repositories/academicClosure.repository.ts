import prisma from '../lib/prisma'
import { chargeBalance } from '../utils/charge-balance'

// El cliente extendido de lib/prisma (tenant-scoping) no es asignable al tipo
// genérico Prisma.TransactionClient de @prisma/client — se infiere el tipo
// real del callback de $transaction en vez de importarlo, mismo truco que ya
// usa scripts/import-cobros-recibos.ts.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const academicClosureRepository = {
  findAll(schoolId: number) {
    return prisma.academicYear.findMany({
      where: { schoolId },
      include: { economicClosedBy: { select: { id: true, email: true } } },
      orderBy: { year: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.academicYear.findUnique({ where: { id } })
  },

  findActiveAcademicYear(schoolId: number) {
    return prisma.academicYear.findFirst({ where: { schoolId, isActive: true } })
  },

  // Cargos pendientes/parciales de tutor de la gestión a cerrar — lo que el
  // cierre económico traslada a la gestión activa.
  findPendingTutorCharges(schoolId: number, academicYearId: number) {
    return prisma.charge.findMany({
      where: {
        schoolId,
        academicYearId,
        target: 'TUTOR',
        status: { in: ['PENDIENTE', 'PARCIAL'] },
      },
    })
  },

  // Crea el cargo "Deuda Anterior" trasladado y anula el original, dentro de
  // la misma transacción que orquesta el service — atómico con el resto del
  // cierre (o se traslada todo, o no se traslada nada). Solo se traslada el
  // SALDO PENDIENTE (amount - paidAmount) del original, no el monto completo
  // — lo ya pagado quedó resuelto en la gestión de origen, no corresponde
  // arrastrarlo como si todavía se debiera. El nuevo cargo nace sin pagos
  // propios (paidAmount: 0, status: PENDIENTE) — cualquier pago posterior se
  // registra normalmente sobre él, como cualquier otro cargo de la gestión activa.
  async carryForwardCharge(
    tx: TxClient,
    original: { id: number; title: string; amount: number; paidAmount: number; status: string; parentId: number; schoolId: number },
    destinationAcademicYearId: number,
  ) {
    const created = await tx.charge.create({
      data: {
        title: `Deuda Anterior — ${original.title}`,
        amount: chargeBalance(original),
        paidAmount: 0,
        type: 'DEUDA_ANTERIOR',
        status: 'PENDIENTE',
        target: 'TUTOR',
        parentId: original.parentId,
        academicYearId: destinationAcademicYearId,
        schoolId: original.schoolId,
        sourceChargeId: original.id,
      },
    })
    await tx.charge.update({ where: { id: original.id }, data: { status: 'ANULADO' } })
    return created
  },

  closeAcademicYear(tx: TxClient, academicYearId: number, actingUserId: number) {
    return tx.academicYear.update({
      where: { id: academicYearId },
      data: { economicClosedAt: new Date(), economicClosedById: actingUserId },
    })
  },

  reopenAcademicYear(id: number) {
    return prisma.academicYear.update({
      where: { id },
      data: { economicClosedAt: null, economicClosedById: null },
    })
  },
}

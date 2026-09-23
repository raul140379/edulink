import prisma from '../lib/prisma'
import { AuditAction } from '@prisma/client'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const auditLogRepository = {
  // `tx` opcional: cuando la acción que se audita corre dentro de una
  // transacción, se pasa ese `tx` acá para que el log y el borrado/
  // sobrescritura sean atómicos entre sí (ver CLAUDE.md 17.1).
  create(
    data: {
      action: AuditAction
      entityType: string
      entityId: number
      before?: object
      after?: object
      reason?: string
      actorUserId: number | null
      schoolId: number
    },
    tx?: TxClient,
  ) {
    return (tx ?? prisma).auditLog.create({ data })
  },

  // Trae el motivo (reason) del AuditLog más reciente por entidad -- usado
  // para mostrar "por qué" se anuló un cargo (badge "Anulado — {motivo}")
  // sin relación Prisma directa (AuditLog es genérico/polimórfico a
  // propósito, ver CLAUDE.md 17.1). Una sola consulta batch, sirve tanto
  // para 1 cargo como para una lista completa (Verificación por Curso).
  async findLatestReasonsByEntityIds(entityType: string, entityIds: number[]): Promise<Map<number, string | null>> {
    if (entityIds.length === 0) return new Map()
    const rows = await prisma.auditLog.findMany({
      where: { entityType, entityId: { in: entityIds } },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true, reason: true },
    })
    const map = new Map<number, string | null>()
    for (const row of rows) {
      if (!map.has(row.entityId)) map.set(row.entityId, row.reason ?? null)
    }
    return map
  },
}

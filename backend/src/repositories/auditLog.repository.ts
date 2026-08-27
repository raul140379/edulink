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
}

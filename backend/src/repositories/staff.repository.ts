import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const staffRepository = {
  // Usado exclusivamente desde userService.createUser, en la misma
  // transacción que crea el User — nunca como llamada suelta (ver el bug que
  // esto reemplaza: admin/portero/page.tsx llamaba a un endpoint separado
  // que no existía, y el fallo quedaba invisible).
  createTx(tx: TxClient, data: Prisma.StaffUncheckedCreateInput) {
    return tx.staff.create({ data })
  },

  findByUserId(userId: number) {
    return prisma.staff.findUnique({ where: { userId }, select: { id: true } })
  },

  // Staff_userId_fkey es RESTRICT (igual que GateRecord/BiometricTemplate →
  // staffId) — borrar el User de alguien con Staff vinculado revienta esa
  // constraint si no se borra el Staff primero. Antes de intentarlo se
  // consulta si ese Staff tiene actividad real de portería (mismo criterio
  // que countActivityRecords para el User) para rechazar con un mensaje
  // claro en vez de un 500 genérico de Postgres.
  async countActivity(staffId: number) {
    const [gateRecords, biometricTemplates] = await Promise.all([
      prisma.gateRecord.count({ where: { staffId } }),
      prisma.biometricTemplate.count({ where: { staffId } }),
    ])
    return gateRecords + biometricTemplates
  },

  deleteTx(tx: TxClient, id: number) {
    return tx.staff.delete({ where: { id } })
  },
}

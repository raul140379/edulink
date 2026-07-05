import { Prisma } from '@prisma/client'
import { treasuryRepository } from '../repositories/treasury.repository'
import { HttpError } from '../utils/http-error'
import {
  CreateChargeInput, CreateBulkChargesInput, UpdateChargeInput, RegisterPaymentInput,
} from '../schemas/treasury.schema'

export const treasuryService = {
  listCharges(status?: string, type?: string, parentId?: string, academicYearId?: string) {
    const where: Prisma.ChargeWhereInput = {
      ...(status         ? { status: status as any } : {}),
      ...(type           ? { type: type as any } : {}),
      ...(parentId       ? { parentId: parseInt(parentId) } : {}),
      ...(academicYearId ? { academicYearId: parseInt(academicYearId) } : {}),
    }
    return treasuryRepository.findCharges(where)
  },

  async getChargeById(id: number) {
    const charge = await treasuryRepository.findChargeById(id)
    if (!charge) throw new HttpError(404, 'Cargo no encontrado')
    return charge
  },

  async getParentAccount(parentId: number) {
    const parent = await treasuryRepository.findParentForAccount(parentId)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')

    const charges = await treasuryRepository.findChargesByParent(parentId)

    const totalDebt    = charges.reduce((sum, c) => sum + c.amount, 0)
    const totalPaid    = charges.reduce((sum, c) => sum + c.paidAmount, 0)
    const totalPending = totalDebt - totalPaid

    return { parent, charges, summary: { totalDebt, totalPaid, totalPending } }
  },

  async createCharge(input: CreateChargeInput) {
    const parent = await treasuryRepository.findParentRaw(input.parentId)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')

    if (input.target === 'ESTUDIANTE' && input.studentId) {
      const student = await treasuryRepository.findStudentRaw(input.studentId)
      if (!student) throw new HttpError(404, 'Estudiante no encontrado')
    }

    return treasuryRepository.createCharge({
      title: input.title,
      description: input.description || null,
      amount: input.amount,
      type: input.type,
      target: input.target || 'TUTOR',
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      tolerance: input.tolerance || false,
      toleranceNote: input.toleranceNote || null,
      parent: { connect: { id: input.parentId } },
      ...(input.target === 'ESTUDIANTE' && input.studentId ? { student: { connect: { id: input.studentId } } } : {}),
      academicYear: { connect: { id: input.academicYearId } },
    })
  },

  async createBulkCharges(input: CreateBulkChargesInput) {
    const created: any[] = []
    const errors: number[] = []

    for (const parentId of input.parentIds) {
      try {
        const charge = await treasuryRepository.createChargeRaw({
          title: input.title,
          description: input.description || null,
          amount: input.amount,
          type: input.type,
          target: 'TUTOR',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          parentId,
          academicYearId: input.academicYearId,
        })
        created.push(charge)
      } catch {
        errors.push(parentId)
      }
    }

    return { created: created.length, errors: errors.length }
  },

  async updateCharge(id: number, input: UpdateChargeInput) {
    const existing = await treasuryRepository.findChargeRaw(id)
    if (!existing) throw new HttpError(404, 'Cargo no encontrado')
    if (existing.status === 'PAGADO') throw new HttpError(400, 'No se puede modificar un cargo ya pagado')

    const { title, description, amount, dueDate, tolerance, toleranceNote } = input

    return treasuryRepository.updateCharge(id, {
      ...(title         !== undefined ? { title } : {}),
      ...(description   !== undefined ? { description: description || null } : {}),
      ...(amount        !== undefined ? { amount } : {}),
      ...(dueDate       !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(tolerance     !== undefined ? { tolerance } : {}),
      ...(toleranceNote !== undefined ? { toleranceNote: toleranceNote || null } : {}),
    })
  },

  async cancelCharge(id: number) {
    const existing = await treasuryRepository.findChargeRaw(id)
    if (!existing) throw new HttpError(404, 'Cargo no encontrado')
    if (existing.status === 'PAGADO') throw new HttpError(400, 'No se puede anular un cargo ya pagado')

    await treasuryRepository.setChargeStatus(id, 'ANULADO')
  },

  async registerPayment(id: number, input: RegisterPaymentInput) {
    const charge = await treasuryRepository.findChargeWithPayments(id)
    if (!charge) throw new HttpError(404, 'Cargo no encontrado')
    if (charge.status === 'ANULADO') throw new HttpError(400, 'No se puede registrar pago en un cargo anulado')
    if (charge.status === 'PAGADO') throw new HttpError(400, 'Este cargo ya está completamente pagado')

    const remaining = charge.amount - charge.paidAmount
    if (input.amount > remaining) {
      throw new HttpError(400, `El monto excede el saldo pendiente de Bs. ${remaining.toFixed(2)}`)
    }

    const newPaidAmount = charge.paidAmount + input.amount
    const newStatus     = newPaidAmount >= charge.amount ? 'PAGADO' : 'PARCIAL'

    const payment = await treasuryRepository.createPayment({
      amount: input.amount,
      method: input.method,
      reference: input.reference || null,
      note: input.note || null,
      date: input.date ? new Date(input.date) : new Date(),
      chargeId: id,
      parentId: charge.parentId,
    })

    await treasuryRepository.setChargePaid(id, newPaidAmount, newStatus)

    return {
      payment, newStatus, paidAmount: newPaidAmount,
      remaining: charge.amount - newPaidAmount,
    }
  },

  async getSummary(academicYearId?: string) {
    const where: Prisma.ChargeWhereInput = {
      status: { not: 'ANULADO' },
      ...(academicYearId ? { academicYearId: parseInt(academicYearId) } : {}),
    }
    const charges = await treasuryRepository.findChargesForSummary(where)

    const totalCharged   = charges.reduce((sum, c) => sum + c.amount, 0)
    const totalCollected = charges.reduce((sum, c) => sum + c.paidAmount, 0)
    const totalPending   = totalCharged - totalCollected

    const byStatus = {
      PENDIENTE: charges.filter((c) => c.status === 'PENDIENTE').length,
      PARCIAL:   charges.filter((c) => c.status === 'PARCIAL').length,
      PAGADO:    charges.filter((c) => c.status === 'PAGADO').length,
    }

    const byType = charges.reduce((acc: any, c) => {
      if (!acc[c.type]) acc[c.type] = { count: 0, amount: 0, collected: 0 }
      acc[c.type].count++
      acc[c.type].amount += c.amount
      acc[c.type].collected += c.paidAmount
      return acc
    }, {})

    return { totalCharged, totalCollected, totalPending, byStatus, byType }
  },

  async getParentsWithBalance(academicYearId?: string, search?: string, status?: string) {
    const where: Prisma.ParentWhereInput = {
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { ci:        { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const parents = await treasuryRepository.findParentsWithCharges(where, academicYearId ? parseInt(academicYearId) : undefined)

    const result = parents.map((p) => {
      const totalDebt    = p.charges.reduce((sum, c) => sum + c.amount, 0)
      const totalPaid    = p.charges.reduce((sum, c) => sum + c.paidAmount, 0)
      const totalPending = totalDebt - totalPaid
      const hasDebt      = totalPending > 0

      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone,
        students: p.students,
        summary: { totalDebt, totalPaid, totalPending, hasDebt, chargesCount: p.charges.length },
      }
    })

    if (status === 'CON_DEUDA') return result.filter((p) => p.summary.hasDebt)
    if (status === 'AL_DIA') return result.filter((p) => !p.summary.hasDebt)
    return result
  },
}

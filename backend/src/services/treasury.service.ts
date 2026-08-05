import { Prisma } from '@prisma/client'
import { treasuryRepository } from '../repositories/treasury.repository'
import { delegateRepository } from '../repositories/delegate.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import {
  CreateChargeInput, CreateBulkChargesInput, UpdateChargeInput, RegisterPaymentInput, UpdatePaymentInput,
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

    // Todo cargo va al tutor designado — nunca a un padre/madre vinculado que
    // no tenga ese rol.
    const isTutor = await treasuryRepository.isParentTutor(input.parentId)
    if (!isTutor) throw new HttpError(400, 'Solo se puede generar un cargo al tutor designado del estudiante')

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
      parentId: input.parentId,
      studentId: (input.target === 'ESTUDIANTE' && input.studentId) ? input.studentId : undefined,
      academicYearId: input.academicYearId,
      schoolId: getTenantContext()?.schoolId ?? 0,
    })
  },

  async createBulkCharges(input: CreateBulkChargesInput) {
    const created: any[] = []
    const errors: number[] = []

    const schoolId = getTenantContext()?.schoolId ?? 0
    for (const parentId of input.parentIds) {
      try {
        // Todo cargo va al tutor designado — se salta (no rompe el lote) a
        // quien no tenga ese rol.
        const isTutor = await treasuryRepository.isParentTutor(parentId)
        if (!isTutor) { errors.push(parentId); continue }

        const charge = await treasuryRepository.createChargeRaw({
          title: input.title,
          description: input.description || null,
          amount: input.amount,
          type: input.type,
          target: 'TUTOR',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          parentId,
          academicYearId: input.academicYearId,
          schoolId,
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

    if (input.reference) {
      const dup = await treasuryRepository.findPaymentByReference(input.reference)
      if (dup) throw new HttpError(409, `Ya existe un pago registrado con el comprobante ${input.reference}`)
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

  // Corregir un pago ya registrado — a diferencia de registerPayment (que
  // suma sobre paidAmount), acá hay que RECALCULAR desde cero: sumar todos
  // los demás pagos del cargo (excluyendo el que se edita) más el monto
  // nuevo, para no duplicar el monto original del pago editado.
  async updatePayment(paymentId: number, input: UpdatePaymentInput) {
    const payment = await treasuryRepository.findPaymentById(paymentId)
    if (!payment) throw new HttpError(404, 'Pago no encontrado')
    const charge = payment.charge
    if (charge.status === 'ANULADO') throw new HttpError(400, 'No se puede editar un pago de un cargo anulado')

    if (input.reference && input.reference !== payment.reference) {
      const dup = await treasuryRepository.findPaymentByReference(input.reference)
      if (dup) throw new HttpError(409, `Ya existe un pago registrado con el comprobante ${input.reference}`)
    }

    const newAmount = input.amount ?? payment.amount
    const otherPaymentsTotal = charge.payments
      .filter((p) => p.id !== paymentId)
      .reduce((sum, p) => sum + p.amount, 0)
    const recomputedPaidAmount = otherPaymentsTotal + newAmount

    if (recomputedPaidAmount > charge.amount) {
      throw new HttpError(400, `El monto excede el saldo del cargo (máximo Bs. ${(charge.amount - otherPaymentsTotal).toFixed(2)})`)
    }

    const newStatus = recomputedPaidAmount >= charge.amount
      ? 'PAGADO'
      : recomputedPaidAmount > 0 ? 'PARCIAL' : 'PENDIENTE'

    const updated = await treasuryRepository.updatePayment(paymentId, {
      ...(input.amount    !== undefined ? { amount: input.amount } : {}),
      ...(input.method    !== undefined ? { method: input.method } : {}),
      ...(input.reference !== undefined ? { reference: input.reference || null } : {}),
      ...(input.note      !== undefined ? { note: input.note || null } : {}),
      ...(input.date      !== undefined ? { date: new Date(input.date) } : {}),
    })

    await treasuryRepository.setChargePaid(charge.id, recomputedPaidAmount, newStatus)

    return {
      payment: updated, newStatus, paidAmount: recomputedPaidAmount,
      remaining: charge.amount - recomputedPaidAmount,
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
        id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone, kardex: p.kardex,
        students: p.students,
        summary: { totalDebt, totalPaid, totalPending, hasDebt, chargesCount: p.charges.length },
      }
    })

    if (status === 'CON_DEUDA') return result.filter((p) => p.summary.hasDebt)
    if (status === 'AL_DIA') return result.filter((p) => !p.summary.hasDebt)
    return result
  },

  async getTreasuryByCourse(academicYearId?: string) {
    const ctx = getTenantContext()
    const schoolId = ctx?.schoolId ?? 0

    let yearId = academicYearId ? parseInt(academicYearId) : undefined
    if (!yearId) {
      const activeYear = await delegateRepository.findActiveAcademicYear()
      yearId = activeYear?.id
    }
    if (!yearId) throw new HttpError(404, 'No hay gestión académica activa')

    const courses = await treasuryRepository.findChargesGroupedByCourse(schoolId, yearId)

    return courses.map((course) => {
      // Un mismo tutor puede tener más de un hijo en el curso — se agrupa por
      // padre para no listarlo duplicado dentro del propio curso.
      const tutorsMap = new Map<number, any>()
      for (const assignment of course.assignments) {
        for (const ps of assignment.student.parents) {
          const p = ps.parent
          if (tutorsMap.has(p.id)) continue
          const totalDebt    = p.charges.reduce((sum: number, c: any) => sum + c.amount, 0)
          const totalPaid    = p.charges.reduce((sum: number, c: any) => sum + c.paidAmount, 0)
          const totalPending = totalDebt - totalPaid
          // Un cargo TUTOR (sin studentId) no pertenece a un solo curso si el
          // padre tiene hijos en cursos distintos — se muestra en cada uno
          // donde tenga un hijo activo, marcado como compartido. No se
          // duplica en base de datos, solo en esta vista agrupada.
          const hasSharedCharge = p.charges.some((c: any) => c.studentId == null)
          tutorsMap.set(p.id, {
            id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone, kardex: p.kardex,
            studentName: `${assignment.student.lastName} ${assignment.student.firstName}`,
            summary: { totalDebt, totalPaid, totalPending, hasDebt: totalPending > 0, hasSharedCharge, chargesCount: p.charges.length },
          })
        }
      }

      // Ordenado por apellido del estudiante (studentName ya viene armado como
      // "Apellido Nombre") — no por el nombre del tutor.
      const tutores = Array.from(tutorsMap.values()).sort((a: any, b: any) => a.studentName.localeCompare(b.studentName, 'es'))

      return {
        course: { id: course.id, level: course.level, grade: course.grade, parallel: course.parallel, shift: course.shift },
        tutores,
      }
    })
  },
}

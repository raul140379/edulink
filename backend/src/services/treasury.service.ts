import { Prisma, Role } from '@prisma/client'
import { treasuryRepository } from '../repositories/treasury.repository'
import { delegateRepository } from '../repositories/delegate.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import {
  CreateChargeInput, CreateBulkChargesInput, UpdateChargeInput, RegisterPaymentInput, UpdatePaymentInput,
} from '../schemas/treasury.schema'
import { chargeBalance, aggregateChargeBalances } from '../utils/charge-balance'
import { assertDelegateOwnsParent, resolveDelegateCourseId } from '../utils/delegate-scope'

// JUNTA_NUCLEO/JUNTA_DISTRITO tienen permisos de Tesorería otorgados mas su
// contexto no trae schoolId propio (operan a nivel núcleo/distrito) — sin
// este chequeo explícito por rol, la lectura se filtraba igual con el resto
// de su núcleo/distrito vía la rama genérica del motor de tenant-scoping
// (pensada para otros modelos), y la escritura producía un schoolId inválido.
// Chequeo por ROL (no por `schoolId == null`) a propósito: SUPER_ADMIN
// también tiene schoolId null en la base, y no debe bloquearse acá.
function assertHasOwnSchool() {
  const ctx = getTenantContext()
  if (ctx?.role === Role.JUNTA_NUCLEO || ctx?.role === Role.JUNTA_DISTRITO) {
    throw new HttpError(400, 'Tu rol no tiene un colegio propio asociado — la Tesorería a nivel Núcleo/Distrito todavía no está disponible')
  }
}

export const treasuryService = {
  getPaymentsHistory() {
    assertHasOwnSchool()
    return treasuryRepository.findAllPayments()
  },

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
    assertHasOwnSchool()

    const parent = await treasuryRepository.findParentForAccount(parentId)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')

    const studentIds = await treasuryRepository.findParentStudentIds(parentId)
    await assertDelegateOwnsParent(studentIds, 'Solo podés ver la cuenta de tutores de estudiantes de tu propio curso')

    const charges = await treasuryRepository.findChargesByParent(parentId)

    // DIRECTOR/REGENTE/SECRETARY: solo un estado simple (al día / con deuda),
    // nunca el detalle de cargos/pagos/recibos — la administración de esos
    // datos es exclusiva de Junta Escolar; para más detalle deben coordinar
    // con ella directamente.
    const ctx = getTenantContext()
    if (ctx?.role === Role.DIRECTOR || ctx?.role === Role.REGENTE || ctx?.role === Role.SECRETARY) {
      const { totalPending } = aggregateChargeBalances(charges)
      return {
        parent: { id: parent.id, firstName: parent.firstName, lastName: parent.lastName },
        estado: totalPending > 0 ? 'CON_DEUDA' as const : 'AL_DIA' as const,
      }
    }

    return { parent, charges, summary: aggregateChargeBalances(charges) }
  },

  async createCharge(input: CreateChargeInput) {
    assertHasOwnSchool()

    const parent = await treasuryRepository.findParentRaw(input.parentId)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')

    // Todo cargo va al tutor designado — nunca a un padre/madre vinculado que
    // no tenga ese rol.
    const isTutor = await treasuryRepository.isParentTutor(input.parentId)
    if (!isTutor) throw new HttpError(400, 'Solo se puede generar un cargo al tutor designado del estudiante')

    const studentIds = await treasuryRepository.findParentStudentIds(input.parentId)
    await assertDelegateOwnsParent(studentIds, 'Solo podés generar cargos a tutores de estudiantes de tu propio curso')

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

    assertHasOwnSchool()
    const schoolId = getTenantContext()?.schoolId ?? 0

    for (const parentId of input.parentIds) {
      try {
        // Todo cargo va al tutor designado — se salta (no rompe el lote) a
        // quien no tenga ese rol.
        const isTutor = await treasuryRepository.isParentTutor(parentId)
        if (!isTutor) { errors.push(parentId); continue }

        // Para DELEGATE: se salta (no rompe el lote) a cualquier tutor que no
        // sea de su propio curso — mismo criterio que el cargo individual,
        // pero sin abortar el resto del lote por un solo caso fuera de alcance.
        const studentIds = await treasuryRepository.findParentStudentIds(parentId)
        await assertDelegateOwnsParent(studentIds, 'fuera de curso')

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

    const studentIds = await treasuryRepository.findParentStudentIds(charge.parentId)
    await assertDelegateOwnsParent(studentIds, 'Solo podés registrar pagos de tutores de estudiantes de tu propio curso')

    const remaining = chargeBalance(charge)
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
      remaining: chargeBalance({ amount: charge.amount, paidAmount: newPaidAmount }),
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

    const studentIds = await treasuryRepository.findParentStudentIds(charge.parentId)
    await assertDelegateOwnsParent(studentIds, 'Solo podés editar pagos de tutores de estudiantes de tu propio curso')

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
      remaining: chargeBalance({ amount: charge.amount, paidAmount: recomputedPaidAmount }),
    }
  },

  // Sin academicYearId explícito, se usa la gestión activa por defecto (mismo
  // criterio que getTreasuryByCourse/getVerificationReportByCourse) — antes
  // agregaba TODAS las gestiones juntas, inconsistente con el resto del
  // sistema. Además del total combinado (se mantiene igual, para no romper
  // nada que ya lo consuma), se desglosa en "gestión actual" (cargos
  // normales) vs. "deuda trasladada" (type: DEUDA_ANTERIOR, cargos que
  // vienen de un cierre económico de una gestión anterior) — identificador
  // limpio, no requiere heurística.
  async getSummary(academicYearId?: string) {
    assertHasOwnSchool()

    let yearId = academicYearId ? parseInt(academicYearId) : undefined
    if (!yearId) {
      const activeYear = await delegateRepository.findActiveAcademicYear()
      yearId = activeYear?.id
    }
    if (!yearId) throw new HttpError(404, 'No hay gestión académica activa')

    // DELEGATE: acota el resumen a los tutores de su propio curso — antes
    // agregaba los cargos de TODO el colegio (mismo permiso CHARGE_VIEW_ALL
    // que JUNTA_ESCOLAR, sin distinción de alcance).
    const delegateCourseId = await resolveDelegateCourseId()
    const parentIdFilter = delegateCourseId
      ? await delegateRepository.findTutorParentIdsForCourse(delegateCourseId, yearId)
      : undefined

    const where: Prisma.ChargeWhereInput = {
      status: { not: 'ANULADO' }, academicYearId: yearId,
      ...(parentIdFilter ? { parentId: { in: parentIdFilter } } : {}),
    }
    const charges = await treasuryRepository.findChargesForSummary(where)

    const { totalDebt: totalCharged, totalPaid: totalCollected, totalPending } = aggregateChargeBalances(charges)

    const trasladada    = charges.filter((c) => c.type === 'DEUDA_ANTERIOR')
    const gestionActual = charges.filter((c) => c.type !== 'DEUDA_ANTERIOR')
    const deudaTrasladada = aggregateChargeBalances(trasladada)
    const deudaGestionActual = aggregateChargeBalances(gestionActual)

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

    return {
      totalCharged, totalCollected, totalPending, byStatus, byType,
      gestionActual: {
        totalCharged: deudaGestionActual.totalDebt, totalCollected: deudaGestionActual.totalPaid, totalPending: deudaGestionActual.totalPending,
      },
      deudaTrasladada: {
        totalCharged: deudaTrasladada.totalDebt, totalCollected: deudaTrasladada.totalPaid, totalPending: deudaTrasladada.totalPending,
      },
    }
  },

  // Mismo criterio de gestión activa por defecto que getSummary — no lleva
  // desglose gestionActual/deudaTrasladada por tutor, eso solo se pidió para
  // las vistas de resumen (getSummary), no para esta tabla.
  async getParentsWithBalance(academicYearId?: string, search?: string, status?: string) {
    assertHasOwnSchool()

    let yearId = academicYearId ? parseInt(academicYearId) : undefined
    if (!yearId) {
      const activeYear = await delegateRepository.findActiveAcademicYear()
      yearId = activeYear?.id
    }
    if (!yearId) throw new HttpError(404, 'No hay gestión académica activa')

    // DELEGATE: acota el listado a los tutores de su propio curso — mismo
    // criterio que getSummary.
    const delegateCourseId = await resolveDelegateCourseId()
    const parentIdFilter = delegateCourseId
      ? await delegateRepository.findTutorParentIdsForCourse(delegateCourseId, yearId)
      : undefined

    const where: Prisma.ParentWhereInput = {
      ...(parentIdFilter ? { id: { in: parentIdFilter } } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { ci:        { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const parents = await treasuryRepository.findParentsWithCharges(where, yearId)

    const result = parents.map((p) => {
      const { totalDebt, totalPaid, totalPending } = aggregateChargeBalances(p.charges)
      const hasDebt = totalPending > 0

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

    // DELEGATE: acota a su propio curso — antes traía todos los cursos del
    // colegio (mismo hallazgo que "Familias").
    const delegateCourseId = await resolveDelegateCourseId()
    const courses = await treasuryRepository.findChargesGroupedByCourse(schoolId, yearId, delegateCourseId)

    const now = new Date()

    return courses.map((course) => {
      // Un mismo tutor puede tener más de un hijo en el curso — se agrupa por
      // padre para no listarlo duplicado dentro del propio curso.
      const tutorsMap = new Map<number, any>()
      for (const assignment of course.assignments) {
        for (const ps of assignment.student.parents) {
          const p = ps.parent
          if (tutorsMap.has(p.id)) continue
          const { totalDebt, totalPaid, totalPending } = aggregateChargeBalances(p.charges)
          const hasDebt       = totalPending > 0
          // Vencido = tiene al menos un cargo con saldo pendiente cuya fecha
          // de vencimiento ya pasó — distinto de "deudor a tiempo".
          const hasOverdue = p.charges.some((c: any) => c.dueDate && new Date(c.dueDate) < now && chargeBalance(c) > 0)
          const estado = hasOverdue ? 'VENCIDO' : hasDebt ? 'DEUDOR' : 'AL_DIA'
          // Un cargo TUTOR (sin studentId) no pertenece a un solo curso si el
          // padre tiene hijos en cursos distintos — se muestra en cada uno
          // donde tenga un hijo activo, marcado como compartido. No se
          // duplica en base de datos, solo en esta vista agrupada.
          const hasSharedCharge = p.charges.some((c: any) => c.studentId == null)
          tutorsMap.set(p.id, {
            id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone, kardex: p.kardex,
            studentName: `${assignment.student.lastName} ${assignment.student.firstName}`,
            charges: p.charges,
            estado,
            summary: { totalDebt, totalPaid, totalPending, hasDebt, hasOverdue, hasSharedCharge, chargesCount: p.charges.length },
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

  // Reporte de verificación por curso — una fila por estudiante (los hermanos
  // no se dedupean, a diferencia de getTreasuryByCourse) para poder cruzar
  // visualmente contra una planilla externa, curso por curso, tipo de aporte
  // por tipo de aporte. Ver plan de reporte técnico de tesorería.
  async getVerificationReportByCourse(academicYearId?: string, courseId?: string) {
    assertHasOwnSchool()

    const ctx = getTenantContext()
    const schoolId = ctx?.schoolId ?? 0

    let yearId = academicYearId ? parseInt(academicYearId) : undefined
    if (!yearId) {
      const activeYear = await delegateRepository.findActiveAcademicYear()
      yearId = activeYear?.id
    }
    if (!yearId) throw new HttpError(404, 'No hay gestión académica activa')

    // DELEGATE: fuerza su propio curso sin importar qué courseId se haya
    // pedido en la query — este es el endpoint que originó el reporte inicial
    // de "Verificación por Curso" mostrando todos los cursos del colegio.
    const delegateCourseId = await resolveDelegateCourseId()
    const effectiveCourseId = delegateCourseId ?? (courseId ? parseInt(courseId) : undefined)

    const types = await treasuryRepository.findMandatoryChargesForYear(schoolId, yearId)
    const courses = await treasuryRepository.findVerificationByCourse(schoolId, yearId, effectiveCourseId)

    // Para el resumen global se cuenta por TUTOR único, no por fila de
    // estudiante — un mismo cargo de aporte es por familia (target: TUTOR), así
    // que dos hermanos no deben contarse dos veces en "cuántos tutores pagaron".
    const summaryByType = new Map<number, { seenParentIds: Set<number>; pagadoCompleto: number; parcial: number; trasladado: number; noPagado: number }>()
    for (const t of types) summaryByType.set(t.id, { seenParentIds: new Set(), pagadoCompleto: 0, parcial: 0, trasladado: 0, noPagado: 0 })

    let totalStudents = 0

    const courseRows = courses.map((course) => {
      const students = course.assignments.map((assignment) => {
        totalStudents++
        const tutorLink = assignment.student.parents[0]
        const tutor = tutorLink?.parent ?? null

        const byType: Record<number, { chargeId?: number; estado: string; monto: number; pagado: number; pendiente: number; referencia?: string; pendingVerificationNote?: string; refunded?: number; refundReason?: string; destino?: { chargeId: number; year: number; status: string } }> = {}
        for (const type of types) {
          const charge = tutor?.charges.find((c) => c.mandatoryChargeId === type.id)
          const entry = summaryByType.get(type.id)!
          // N° de recibo — ya cargado por el import histórico, se muestra tal
          // cual quedó registrado (varios pagos parciales -> varios recibos).
          const referencia = charge?.payments.map((p) => p.reference).filter(Boolean).join(', ') || undefined
          // Import CSV con "recibo" tipo TRANF/banca móvil: cargo PENDIENTE
          // pero con nota — se distingue de un "no pagó" normal en pantalla.
          const pendingVerificationNote = charge?.pendingVerificationNote || undefined
          // Devolución interna (pago duplicado) — informativa, no cambia
          // estado/paidAmount del cargo (ver Refund).
          const refunded = charge?.refunds.length ? charge.refunds.reduce((s, r) => s + r.amount, 0) : undefined
          const refundReason = charge?.refunds.length ? charge.refunds.map((r) => r.reason).join('; ') : undefined

          if (!charge) {
            byType[type.id] = { estado: 'NO_CARGADO', monto: type.amount, pagado: 0, pendiente: type.amount }
          } else if (charge.status === 'ANULADO') {
            // Solo llega ANULADO acá si tiene carriedCharges (ver
            // findVerificationByCourse) — se trasladó, no se "canceló".
            const dest = charge.carriedCharges[0]
            byType[type.id] = {
              chargeId: charge.id, estado: 'TRASLADADO', monto: charge.amount, pagado: charge.paidAmount, pendiente: chargeBalance(charge), referencia,
              destino: dest ? { chargeId: dest.id, year: dest.academicYear.year, status: dest.status } : undefined,
            }
          } else {
            byType[type.id] = { chargeId: charge.id, estado: charge.status, monto: charge.amount, pagado: charge.paidAmount, pendiente: chargeBalance(charge), referencia, pendingVerificationNote, refunded, refundReason }
          }

          // El conteo del resumen es por tutor único — si ya se contó a este
          // tutor para este tipo (otro hermano en otro curso), no se repite.
          if (tutor && !entry.seenParentIds.has(tutor.id)) {
            entry.seenParentIds.add(tutor.id)
            const estado = byType[type.id].estado
            if (estado === 'PAGADO') entry.pagadoCompleto++
            else if (estado === 'PARCIAL') entry.parcial++
            else if (estado === 'TRASLADADO') entry.trasladado++
            else entry.noPagado++
          }
        }

        return {
          student: { id: assignment.student.id, firstName: assignment.student.firstName, lastName: assignment.student.lastName, isActive: assignment.student.isActive },
          tutor: tutor ? { id: tutor.id, firstName: tutor.firstName, lastName: tutor.lastName, ci: tutor.ci, kardex: tutor.kardex } : null,
          byType,
        }
      }).sort((a, b) => `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`, 'es'))

      return {
        course: { id: course.id, level: course.level, grade: course.grade, parallel: course.parallel, shift: course.shift },
        students,
      }
    })

    const summary = types.map((t) => {
      const entry = summaryByType.get(t.id)!
      return {
        mandatoryChargeId: t.id, title: t.title, type: t.type, amount: t.amount,
        pagadoCompleto: entry.pagadoCompleto, parcial: entry.parcial, trasladado: entry.trasladado, noPagado: entry.noPagado,
      }
    })

    // El frontend arma las columnas dinámicas por mandatoryChargeId — `types`
    // trae `id` (el nombre real de la PK de MandatoryCharge), así que se
    // renombra acá para la respuesta, igual que ya se hace en `summary`.
    const typesForResponse = types.map((t) => ({ mandatoryChargeId: t.id, title: t.title, type: t.type, amount: t.amount }))

    return { academicYearId: yearId, totalStudents, types: typesForResponse, summary, courses: courseRows }
  },
}

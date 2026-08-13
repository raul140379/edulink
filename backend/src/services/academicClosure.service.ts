import * as XLSX from 'xlsx'
import prisma from '../lib/prisma'
import { academicClosureRepository } from '../repositories/academicClosure.repository'
import { treasuryRepository } from '../repositories/treasury.repository'
import { mandatoryChargeRepository } from '../repositories/mandatoryCharge.repository'
import { parentRepository } from '../repositories/parent.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { HistoricalCorrectionInput, CreateAndCarryForwardInput, RegisterRefundInput } from '../schemas/treasury.schema'

// Validación compartida entre createHistoricalCharge y createAndCarryForwardCharge
// — ambas parten del mismo "no existe ningún Charge todavía, hay que crearlo
// para la gestión ya cerrada que se está auditando", solo difieren en si
// además lo trasladan a la gestión activa.
async function resolveHistoricalChargeInputs(input: CreateAndCarryForwardInput) {
  const template = await mandatoryChargeRepository.findById(input.mandatoryChargeId)
  if (!template) throw new HttpError(404, 'Cargo obligatorio no encontrado')

  const isTutor = await treasuryRepository.isParentTutor(input.parentId)
  if (!isTutor) throw new HttpError(400, 'Solo se puede generar un cargo al tutor designado del estudiante')

  // El aporte es por tutor, no por estudiante — si este tutor ya tiene un
  // cargo de este tipo en esta gestión (ej. registrado desde la fila de otro
  // hijo), no se crea uno nuevo: hay que editar el que ya existe.
  const existingCharge = await treasuryRepository.findChargeByParentTemplate(input.parentId, input.academicYearId, input.mandatoryChargeId)
  if (existingCharge) {
    throw new HttpError(409, `Este tutor ya tiene un cargo de este tipo en esta gestión (id ${existingCharge.id}) — probablemente registrado desde otro hijo. Editalo en vez de crear uno nuevo.`)
  }

  const sourceYear = await academicClosureRepository.findById(input.academicYearId)
  if (!sourceYear) throw new HttpError(404, 'Gestión no encontrada')
  if (!sourceYear.economicClosedAt) throw new HttpError(400, 'La gestión de origen todavía no está cerrada económicamente')

  const amount = input.amount ?? template.amount
  const paidAmount = input.paid ? (input.paidAmount ?? amount) : 0
  if (paidAmount > amount) throw new HttpError(400, 'El monto pagado no puede exceder el monto de la plantilla')

  if (input.reference) {
    const dup = await treasuryRepository.findPaymentByReference(input.reference)
    if (dup) throw new HttpError(409, `Ya existe un pago registrado con el comprobante ${input.reference}`)
  }

  const status = paidAmount <= 0 ? 'PENDIENTE' : paidAmount >= amount ? 'PAGADO' : 'PARCIAL'
  return { template, sourceYear, amount, paidAmount, status: status as 'PENDIENTE' | 'PAGADO' | 'PARCIAL' }
}

// Import CSV de aportes por curso (gestión activa), UN tipo de aporte por
// import (elegido una vez, no por fila) — dry-run (preview) y aplicación real
// comparten exactamente este mismo recorrido, fila por fila y en orden, para
// que el chequeo de duplicado (findChargeByParentTemplate) vea en
// `commit: true` los cargos recién creados por filas anteriores del MISMO
// archivo (2 hermanos nuevos en el mismo CSV: la 2da fila debe encontrar el
// cargo que acaba de crear la 1ra, no generar uno duplicado). Por eso en
// preview ambas filas se muestran como "se crearía" — información correcta
// en ese momento — y recién en apply una de las dos termina en "ya existía".
//
// La planilla física de origen no tiene ningún ID único por fila — la fila N
// se asume correspondiente al estudiante en la posición N del mismo orden
// alfabético que ya usa Verificación por Curso (ver el sort más abajo, calcado
// de treasury.service.ts:getVerificationReportByCourse). El kardex_tutor de
// esa fila es un chequeo de seguridad contra una planilla desalineada (un
// estudiante se dio de baja/alta y las filas quedaron corridas), no un
// identificador libre — se valida contra el tutor REAL de esa posición, no se
// busca sin más.
async function runCourseImport(courseId: number, mandatoryChargeId: number, fileBuffer: Buffer, commit: boolean) {
  const schoolId = getTenantContext()?.schoolId ?? 0

  const activeYear = await academicClosureRepository.findActiveAcademicYear(schoolId)
  if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

  const template = await mandatoryChargeRepository.findById(mandatoryChargeId)
  if (!template || template.schoolId !== schoolId || template.academicYearId !== activeYear.id || !template.isActive) {
    throw new HttpError(404, 'Cargo obligatorio no encontrado para esta gestión')
  }

  // Mismo query que findVerificationByCourse (courseId acota a un único
  // Course, ya scoped por schoolId vía Course en DIRECT_SCHOOL_SCOPED_MODELS)
  // — curso inexistente o de otro colegio vuelve un array vacío acá.
  const [courseWithAssignments] = await treasuryRepository.findVerificationByCourse(schoolId, activeYear.id, courseId)
  if (!courseWithAssignments) throw new HttpError(404, 'Curso no encontrado')

  // Mismo orden exacto que la tabla en pantalla — INCLUYE retirados, porque
  // esa tabla tampoco los excluye por defecto (ver isRowAlDia/filterRows en
  // el frontend, que filtran por estado de cuenta, no por isActive).
  const roster = courseWithAssignments.assignments
    .map((a: any) => ({ student: a.student, tutor: a.student.parents[0]?.parent ?? null }))
    .sort((a: any, b: any) => `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`, 'es'))

  let rawRows: Record<string, any>[]
  try {
    // CSV crudo, no un binario XLSX (cuyo shared-strings XML siempre es UTF-8
    // y no tiene este problema) — hay que decodificar el buffer como texto
    // UTF-8 explícitamente antes de pasarlo a XLSX.read, si no asume la
    // codepage del sistema y los acentos ("Inscripción") llegan mal
    // interpretados ("InscripciÃ³n").
    const workbook = XLSX.read(fileBuffer.toString('utf8'), { type: 'string' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    // sheet_to_json en modo objeto (sin header:1) DESCARTA filas completamente
    // vacías en vez de devolverlas con columnas en '' — fatal acá, porque
    // corre el resto de las filas una posición hacia arriba (una fila real
    // "no pagó" con recibo/monto/fecha_pago vacíos podría, en el borde,
    // coincidir con eso). header:1 + blankrows:true preserva el índice de
    // fila siempre, así que se arma el objeto a mano con los headers reales.
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true }) as any[][]
    const headerRow = (aoa[0] || []).map((h) => String(h).trim())
    rawRows = aoa.slice(1)
      // Una fila TOTALMENTE vacía al final del archivo (típico de un salto de
      // línea final al exportar) no es una fila real — se descarta solo si
      // está al final, nunca en medio (una vacía en medio si es real y se
      // rechaza con "Falta kardex_tutor", que es la señal correcta).
      .filter((row, idx, arr) => !(row.every((c) => String(c).trim() === '') && arr.slice(idx + 1).every((r) => r.every((c) => String(c).trim() === ''))))
      .map((row) => {
        const obj: Record<string, any> = {}
        headerRow.forEach((h, i) => { obj[h] = row[i] ?? '' })
        return obj
      })
  } catch {
    throw new HttpError(400, 'No se pudo leer el archivo — asegurate de que sea un CSV válido')
  }

  const results: Record<string, any>[] = []
  let createdCount = 0, wouldCreateCount = 0, existingCount = 0, rejectedCount = 0, skippedCount = 0, updatedCount = 0, wouldUpdateCount = 0

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const rowNumber = i + 2 // 1-based + fila de encabezado
    const position  = i + 1 // posición dentro del curso, mismo orden que pantalla
    try {
      const kardexRow    = String(raw.kardex_tutor ?? '').trim()
      const montoRaw     = String(raw.monto ?? '').trim()
      const reciboRaw    = String(raw.recibo ?? '').trim()
      const fechaPagoRaw = String(raw.fecha_pago ?? '').trim()

      // kardex_tutor vacío no es un error de datos — es "nada que importar en
      // esta posición" (ej. un estudiante sin ningún registro esa gestión).
      // Categoría propia, no cuenta como rechazado ni dispara mensajes de
      // "kardex no encontrado" (eso es solo para cuando SÍ hay un valor y no
      // existe en el sistema).
      if (!kardexRow) {
        skippedCount++
        results.push({ row: rowNumber, position, status: 'skipped', reason: 'Sin kardex_tutor en esta fila — no hay nada que importar, se omite' })
        continue
      }

      const expected = roster[position - 1]
      if (!expected) {
        throw new HttpError(400, `No hay ningún estudiante en la posición ${position} de este curso (el curso tiene ${roster.length} estudiante(s))`)
      }
      if (!expected.tutor) {
        throw new HttpError(400, `${expected.student.lastName} ${expected.student.firstName} (posición ${position}) no tiene tutor legal vinculado — no se puede validar esta fila`)
      }

      const foundParent = await parentRepository.findByKardex(kardexRow)
      if (!foundParent) throw new HttpError(404, `Kardex "${kardexRow}" no encontrado`)
      if (foundParent.id !== expected.tutor.id) {
        throw new HttpError(400,
          `El kardex "${kardexRow}" no corresponde al tutor de ${expected.student.lastName} ${expected.student.firstName} en la posición ${position} ` +
          `(tutor esperado: ${expected.tutor.lastName} ${expected.tutor.firstName}) — posible desalineación, revisá el archivo`)
      }

      const tutor   = expected.tutor
      const student = expected.student

      let amount = template.amount
      if (montoRaw) {
        const parsed = parseFloat(montoRaw)
        if (isNaN(parsed) || parsed <= 0) throw new HttpError(400, `Monto inválido: "${montoRaw}"`)
        amount = parsed
      }

      // "recibo": vacío = no pagó · solo dígitos/guiones = número de recibo
      // real (pagado) · cualquier otra cosa (TRANF, banca móvil...) =
      // transferencia sin confirmar todavía — PENDIENTE igual que "no pagó",
      // pero con nota para diferenciarlo en Verificación por Curso.
      const isNumericRecibo = reciboRaw !== '' && /^[\d\-/]+$/.test(reciboRaw)
      const isTextRecibo    = reciboRaw !== '' && !isNumericRecibo

      // fecha_pago es siempre opcional (la planilla física no la tiene) — si
      // falta, el pago se registra con la fecha de hoy (mismo default que
      // resolveHistoricalChargeInputs usa en el resto de Tesorería).
      let paidDate = new Date()
      if (fechaPagoRaw) {
        const m = fechaPagoRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (!m) throw new HttpError(400, `Formato de fecha_pago inválido: "${fechaPagoRaw}" (debe ser DD/MM/YYYY)`)
        const [, dd, mm, yyyy] = m
        paidDate = new Date(`${yyyy}-${mm}-${dd}T12:00:00`)
        if (isNaN(paidDate.getTime())) throw new HttpError(400, `Fecha de pago inválida: "${fechaPagoRaw}"`)
      }

      if (isNumericRecibo) {
        const dup = await treasuryRepository.findPaymentByReference(reciboRaw)
        if (dup) throw new HttpError(409, `Ya existe un pago registrado con el comprobante "${reciboRaw}"`)
      }

      const pendingVerificationNote = isTextRecibo
        ? `Transferencia sin confirmar (planilla: "${reciboRaw}") — pendiente verificar número`
        : null

      // El aporte es por TUTOR — si este tutor ya tiene un cargo de este tipo
      // en esta gestión (de antes, o recién creado por una fila anterior de
      // este mismo archivo), la fila no crea uno nuevo. Pero un cargo
      // PENDIENTE precreado (ej. los 425 de Cuota Inicial cargados de
      // antemano) SÍ se actualiza con el pago que trae esta fila — antes
      // quedaba como "ya existía" sin registrar el pago real. PAGADO y
      // PARCIAL quedan intocados (PARCIAL ya tiene un pago real propio;
      // completarlo automático sin verificación humana sería arriesgado).
      const existingCharge = await treasuryRepository.findChargeByParentTemplate(tutor.id, activeYear.id, template.id)
      if (existingCharge) {
        const canUpdate = existingCharge.status === 'PENDIENTE' && (isNumericRecibo || isTextRecibo)
        if (!canUpdate) {
          existingCount++
          results.push({
            row: rowNumber, position, status: 'already_exists',
            student: `${student.lastName} ${student.firstName}`, tutor: `${tutor.lastName} ${tutor.firstName}`,
            existingChargeId: existingCharge.id,
            reason: `${tutor.lastName} ${tutor.firstName} ya tiene un cargo "${template.title}" en esta gestión (${existingCharge.status.toLowerCase()}) — no se modifica`,
          })
          continue
        }

        if (!commit) {
          wouldUpdateCount++
          results.push({
            row: rowNumber, position, status: 'would_update',
            student: `${student.lastName} ${student.firstName}`, tutor: `${tutor.lastName} ${tutor.firstName}`,
            existingChargeId: existingCharge.id, amount: existingCharge.amount,
            paid: isNumericRecibo, pendingVerification: isTextRecibo, note: pendingVerificationNote,
          })
          continue
        }

        const updated = isNumericRecibo
          ? await prisma.$transaction(async (tx) => {
              const upd = await tx.charge.update({
                where: { id: existingCharge.id },
                data: { paidAmount: existingCharge.amount, status: 'PAGADO', pendingVerificationNote: null },
              })
              await tx.payment.create({
                data: {
                  amount: existingCharge.amount, reference: reciboRaw || null, method: 'EFECTIVO',
                  date: paidDate, chargeId: existingCharge.id, parentId: tutor.id, schoolId,
                },
              })
              return upd
            })
          // Texto (transferencia sin confirmar) — el cargo se queda PENDIENTE,
          // no cuenta como recaudado, solo se anota la nota de verificación.
          : await prisma.charge.update({ where: { id: existingCharge.id }, data: { pendingVerificationNote } })

        updatedCount++
        results.push({
          row: rowNumber, position, status: 'updated',
          student: `${student.lastName} ${student.firstName}`, tutor: `${tutor.lastName} ${tutor.firstName}`,
          chargeId: updated.id, amount: updated.amount, paid: isNumericRecibo,
          pendingVerification: isTextRecibo, note: pendingVerificationNote,
        })
        continue
      }

      if (!commit) {
        wouldCreateCount++
        results.push({
          row: rowNumber, position, status: 'would_create',
          student: `${student.lastName} ${student.firstName}`, tutor: `${tutor.lastName} ${tutor.firstName}`,
          amount, paid: isNumericRecibo, pendingVerification: isTextRecibo, note: pendingVerificationNote,
        })
        continue
      }

      const paidAmount = isNumericRecibo ? amount : 0
      const status = paidAmount <= 0 ? 'PENDIENTE' : paidAmount >= amount ? 'PAGADO' : 'PARCIAL'

      // Sin studentId a propósito — mismo criterio que createHistoricalCharge:
      // el cargo es del tutor, no de un hijo puntual, así que Verificación
      // por Curso/Deuda Trasladada lo tratan como "compartido" si el tutor
      // tiene otro hijo en un curso distinto (ver hasSharedCharge).
      const charge = await prisma.$transaction(async (tx) => {
        const created = await tx.charge.create({
          data: {
            title: template.title, amount, paidAmount, type: template.type, status, target: 'TUTOR',
            parentId: tutor.id, academicYearId: activeYear.id, schoolId, mandatoryChargeId: template.id,
            pendingVerificationNote,
          },
        })
        if (paidAmount > 0) {
          await tx.payment.create({
            data: {
              amount: paidAmount, reference: reciboRaw || null, method: 'EFECTIVO',
              date: paidDate, chargeId: created.id, parentId: tutor.id, schoolId,
            },
          })
        }
        return created
      })

      createdCount++
      results.push({
        row: rowNumber, position, status: 'created',
        student: `${student.lastName} ${student.firstName}`, tutor: `${tutor.lastName} ${tutor.firstName}`,
        amount, paid: isNumericRecibo, pendingVerification: isTextRecibo, note: pendingVerificationNote, chargeId: charge.id,
      })
    } catch (err) {
      rejectedCount++
      const message = err instanceof HttpError ? err.message : 'Error inesperado procesando esta fila'
      results.push({ row: rowNumber, position, status: 'rejected', reason: message })
    }
  }

  return {
    course: { id: courseWithAssignments.id, level: courseWithAssignments.level, grade: courseWithAssignments.grade, parallel: courseWithAssignments.parallel, shift: courseWithAssignments.shift },
    academicYear: { id: activeYear.id, year: activeYear.year },
    tipoAporte: template.title,
    totalRows: rawRows.length,
    summary: commit
      ? { created: createdCount, updated: updatedCount, alreadyExists: existingCount, rejected: rejectedCount, skipped: skippedCount }
      : { wouldCreate: wouldCreateCount, wouldUpdate: wouldUpdateCount, alreadyExists: existingCount, rejected: rejectedCount, skipped: skippedCount },
    results,
  }
}

export const academicClosureService = {
  previewCourseImport(courseId: number, mandatoryChargeId: number, fileBuffer: Buffer) {
    return runCourseImport(courseId, mandatoryChargeId, fileBuffer, false)
  },

  applyCourseImport(courseId: number, mandatoryChargeId: number, fileBuffer: Buffer) {
    return runCourseImport(courseId, mandatoryChargeId, fileBuffer, true)
  },

  list() {
    const schoolId = getTenantContext()?.schoolId ?? 0
    return academicClosureRepository.findAll(schoolId)
  },

  // Traslada todo Charge PENDIENTE/PARCIAL de tutor de la gestión a cerrar
  // hacia la gestión activa, como DEUDA_ANTERIOR con sourceChargeId hacia el
  // original (que queda ANULADO) — mecanismo permanente de cierre económico,
  // independiente del cierre académico (isActive/ACADEMIC_TRIMESTER_CLOSE).
  async closeEconomicPeriod(academicYearId: number, actingUserId: number) {
    const schoolId = getTenantContext()?.schoolId ?? 0
    const year = await academicClosureRepository.findById(academicYearId)
    if (!year) throw new HttpError(404, 'Gestión no encontrada')
    if (year.isActive) throw new HttpError(400, 'No se puede cerrar económicamente la gestión activa — cerrá una anterior')
    if (year.economicClosedAt) throw new HttpError(400, 'Esta gestión ya está cerrada económicamente')

    const activeYear = await academicClosureRepository.findActiveAcademicYear(schoolId)
    if (!activeYear) throw new HttpError(400, 'No hay una gestión activa a la cual trasladar la deuda pendiente')

    const pendingCharges = await academicClosureRepository.findPendingTutorCharges(schoolId, academicYearId)

    await prisma.$transaction(async (tx) => {
      for (const charge of pendingCharges) {
        await academicClosureRepository.carryForwardCharge(tx, charge, activeYear.id)
      }
      await academicClosureRepository.closeAcademicYear(tx, academicYearId, actingUserId)
    })

    return { carriedCount: pendingCharges.length, destinationAcademicYearId: activeYear.id }
  },

  // No deshace los traslados ya hechos (los Charge DEUDA_ANTERIOR creados y
  // los originales ANULADOS quedan como están) — sirve solo para destrabar un
  // cierre hecho por error antes de terminar de cargar datos.
  async reopenEconomicPeriod(academicYearId: number) {
    const year = await academicClosureRepository.findById(academicYearId)
    if (!year) throw new HttpError(404, 'Gestión no encontrada')
    if (!year.economicClosedAt) throw new HttpError(400, 'Esta gestión no está cerrada económicamente')

    return academicClosureRepository.reopenAcademicYear(academicYearId)
  },

  // Corrige un cargo ya PAGADO/PARCIAL/TRASLADADO — a diferencia de
  // updateCharge/registerPayment/updatePayment (que bloquean justo estos dos
  // estados para proteger el flujo del día a día), esto existe para arreglar
  // datos que el import/backfill histórico cargó mal. `paid` decide de cero
  // si queda con pago o no, no se suma sobre lo existente. Si el cargo es un
  // TRASLADADO (ANULADO con carriedCharges), su estado ANULADO no cambia —
  // solo se corrigen amount/paidAmount/el pago — y la corrección se propaga
  // al cargo Deuda Anterior derivado en la gestión activa, salvo que ese
  // derivado ya tenga pagos propios (ahí se deja intacto y se avisa).
  async correctHistoricalCharge(chargeId: number, input: HistoricalCorrectionInput) {
    const charge = await treasuryRepository.findChargeForCorrection(chargeId)
    if (!charge) throw new HttpError(404, 'Cargo no encontrado')
    if (charge.payments.length > 1) {
      throw new HttpError(400, 'Este cargo tiene más de un pago registrado — corregilo desde el estado de cuenta del tutor')
    }

    const wasAnulado = charge.status === 'ANULADO'
    const newAmount = input.amount ?? charge.amount
    const newPaidAmount = input.paid ? (input.paidAmount ?? newAmount) : 0
    if (newPaidAmount > newAmount) throw new HttpError(400, 'El monto pagado no puede exceder el monto del cargo')

    const existingPayment = charge.payments[0]
    if (input.reference && input.reference !== existingPayment?.reference) {
      const dup = await treasuryRepository.findPaymentByReference(input.reference)
      if (dup) throw new HttpError(409, `Ya existe un pago registrado con el comprobante ${input.reference}`)
    }

    const finalStatus = wasAnulado ? 'ANULADO' : newPaidAmount <= 0 ? 'PENDIENTE' : newPaidAmount >= newAmount ? 'PAGADO' : 'PARCIAL'

    const dest = charge.carriedCharges[0]
    let syncWarning: string | undefined
    let destinoResult: { chargeId: number; year: number; status: string } | undefined

    await prisma.$transaction(async (tx) => {
      await tx.charge.update({
        where: { id: chargeId },
        data: {
          amount: newAmount, paidAmount: newPaidAmount, status: finalStatus,
          // Si el import CSV lo había marcado como "transferencia sin
          // confirmar" (ver runCourseImport), corregirlo acá con un pago real
          // resuelve el caso — la nota deja de aplicar.
          ...(newPaidAmount > 0 ? { pendingVerificationNote: null } : {}),
        },
      })

      if (newPaidAmount > 0) {
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              amount: newPaidAmount, reference: input.reference || null, method: input.method || existingPayment.method,
              date: input.date ? new Date(input.date) : existingPayment.date,
            },
          })
        } else {
          await tx.payment.create({
            data: {
              amount: newPaidAmount, reference: input.reference || null, method: input.method || 'EFECTIVO',
              date: input.date ? new Date(input.date) : new Date(), chargeId, parentId: charge.parentId, schoolId: charge.schoolId,
            },
          })
        }
      } else if (existingPayment) {
        await tx.payment.delete({ where: { id: existingPayment.id } })
      }

      if (wasAnulado && dest) {
        if (dest._count.payments === 0) {
          const destStatus = newPaidAmount <= 0 ? 'PENDIENTE' : newPaidAmount >= newAmount ? 'PAGADO' : 'PARCIAL'
          await tx.charge.update({ where: { id: dest.id }, data: { amount: newAmount, paidAmount: newPaidAmount, status: destStatus } })
          destinoResult = { chargeId: dest.id, year: dest.academicYear.year, status: destStatus }
        } else {
          syncWarning = 'El cargo de la gestión activa ya tiene pagos propios — no se sincronizó automáticamente, revisalo a mano.'
          destinoResult = { chargeId: dest.id, year: dest.academicYear.year, status: dest.status }
        }
      }
    })

    return { chargeId, amount: newAmount, paidAmount: newPaidAmount, status: finalStatus, destino: destinoResult, syncWarning }
  },

  // Traslado manual de UN cargo puntual (PENDIENTE/PARCIAL) que quedó fuera
  // del cierre masivo — misma lógica exacta que closeEconomicPeriod (reusa
  // carryForwardCharge), solo que para un único Charge en vez de barrer todos
  // los de una gestión. Exige que la gestión de origen ya esté cerrada
  // económicamente, para no adelantarse a un cierre formal todavía pendiente.
  async carryForwardSingleCharge(chargeId: number) {
    const charge = await treasuryRepository.findChargeRaw(chargeId)
    if (!charge) throw new HttpError(404, 'Cargo no encontrado')
    if (charge.target !== 'TUTOR') throw new HttpError(400, 'Solo se pueden trasladar cargos de tutor')
    if (!['PENDIENTE', 'PARCIAL'].includes(charge.status)) throw new HttpError(400, 'Solo se puede trasladar un cargo pendiente o parcial')

    const sourceYear = await academicClosureRepository.findById(charge.academicYearId)
    if (!sourceYear?.economicClosedAt) throw new HttpError(400, 'La gestión de origen todavía no está cerrada económicamente')

    const activeYear = await academicClosureRepository.findActiveAcademicYear(charge.schoolId)
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const created = await prisma.$transaction(async (tx) => academicClosureRepository.carryForwardCharge(tx, charge, activeYear.id))

    return { destino: { chargeId: created.id, year: activeYear.year, status: created.status }, destinationAcademicYearId: activeYear.id }
  },

  // "Sin registrar" + "Trasladar a 2026" -> crea el Charge histórico (monto de
  // la plantilla) y, si no queda pagado por completo, lo traslada de inmediato
  // a la gestión activa — las dos acciones en una sola transacción, sin pasos
  // intermedios. Pensado para el caso "confirmé que no pagó".
  async createAndCarryForwardCharge(input: CreateAndCarryForwardInput) {
    const { template, sourceYear, amount, paidAmount, status } = await resolveHistoricalChargeInputs(input)

    const activeYear = await academicClosureRepository.findActiveAcademicYear(sourceYear.schoolId)
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    return prisma.$transaction(async (tx) => {
      const charge = await tx.charge.create({
        data: {
          title: template.title, amount, paidAmount, type: template.type, status, target: 'TUTOR',
          parentId: input.parentId, academicYearId: input.academicYearId, schoolId: sourceYear.schoolId,
          mandatoryChargeId: template.id,
        },
      })

      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            amount: paidAmount, reference: input.reference || null, method: input.method || 'EFECTIVO',
            date: input.date ? new Date(input.date) : new Date(), chargeId: charge.id, parentId: input.parentId, schoolId: sourceYear.schoolId,
          },
        })
      }

      if (status === 'PAGADO') {
        return { charge, carried: false as const }
      }

      const created = await academicClosureRepository.carryForwardCharge(tx, charge, activeYear.id)
      return { charge, carried: true as const, destino: { chargeId: created.id, year: activeYear.year, status: created.status } }
    })
  },

  // "Sin registrar" + "Editar" -> crea el Charge histórico dejándolo como
  // corresponda (pagado/parcial/pendiente) SIN trasladarlo — para el caso
  // "confirmé que sí pagó, solo nunca se cargó". Si queda con saldo, el botón
  // "Trasladar a 2026" ya alcanza para moverlo después, como a cualquier otro
  // cargo pendiente — no hace falta duplicar esa lógica acá.
  async createHistoricalCharge(input: CreateAndCarryForwardInput) {
    const { template, sourceYear, amount, paidAmount, status } = await resolveHistoricalChargeInputs(input)

    return prisma.$transaction(async (tx) => {
      const charge = await tx.charge.create({
        data: {
          title: template.title, amount, paidAmount, type: template.type, status, target: 'TUTOR',
          parentId: input.parentId, academicYearId: input.academicYearId, schoolId: sourceYear.schoolId,
          mandatoryChargeId: template.id,
        },
      })

      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            amount: paidAmount, reference: input.reference || null, method: input.method || 'EFECTIVO',
            date: input.date ? new Date(input.date) : new Date(), chargeId: charge.id, parentId: input.parentId, schoolId: sourceYear.schoolId,
          },
        })
      }

      return { charge }
    })
  },

  // Devolución interna de un pago duplicado (ej. dos recibos por el mismo
  // aporte) — puramente aditiva, nunca toca Charge.status ni
  // Charge.paidAmount. El monto disponible es paidAmount menos lo ya
  // devuelto antes (puede haber más de una devolución sobre el mismo cargo).
  async registerRefund(chargeId: number, input: RegisterRefundInput) {
    const charge = await treasuryRepository.findChargeWithRefunds(chargeId)
    if (!charge) throw new HttpError(404, 'Cargo no encontrado')

    const alreadyRefunded = charge.refunds.reduce((sum, r) => sum + r.amount, 0)
    const available = charge.paidAmount - alreadyRefunded
    if (input.amount > available) {
      throw new HttpError(400,
        `No se puede devolver Bs. ${input.amount.toFixed(2)}, el cargo solo tiene Bs. ${charge.paidAmount.toFixed(2)} pagado` +
        (alreadyRefunded > 0 ? `, de los cuales Bs. ${alreadyRefunded.toFixed(2)} ya fueron devueltos anteriormente` : '') +
        ` (disponible: Bs. ${available.toFixed(2)})`)
    }

    const ctx = getTenantContext()
    const refund = await treasuryRepository.createRefund({
      amount: input.amount, reason: input.reason,
      date: input.date ? new Date(input.date) : new Date(),
      chargeId, handledById: ctx?.userId ?? null, schoolId: charge.schoolId,
    })

    return { refund, totalRefunded: alreadyRefunded + input.amount }
  },
}

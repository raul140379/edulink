import prisma from '../lib/prisma'
import { MandatoryChargeScope, AcademicLevel, Grade, ChargeType } from '@prisma/client'
import { normalizeChargeTitle } from '../utils/charge-concept'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Alcance de una plantilla, ya resuelto a la condición Prisma que hay que
// anidar dentro de `assignments: { some: { academicYearId, ... } } }` al
// buscar tutores — TODOS no agrega nada, GRADO filtra por nivel+grado del
// curso (todos los paralelos), CURSO filtra por el curso puntual. Un solo
// helper para que "aplicar a faltantes" y "aplicar a tutor nuevo" (los 2
// llamadores de findTutorsMissingCharge) queden siempre consistentes.
function scopeToCourseWhere(scope: { scope: MandatoryChargeScope; scopeLevel: AcademicLevel | null; scopeGrade: Grade | null; scopeCourseId: number | null }) {
  if (scope.scope === 'GRADO') return { course: { level: scope.scopeLevel!, grade: scope.scopeGrade! } }
  if (scope.scope === 'CURSO') return { courseId: scope.scopeCourseId! }
  return {}
}

export const mandatoryChargeRepository = {
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true } })
  },

  findAll(schoolId: number) {
    return prisma.mandatoryCharge.findMany({
      where: { schoolId },
      include: {
        academicYear: { select: { id: true, year: true } },
        scopeCourse: { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
        _count: { select: { charges: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.mandatoryCharge.findUnique({ where: { id } })
  },

  create(data: {
    title: string; description: string | null; amount: number; type: any; dueDate: Date | null
    academicYearId: number; schoolId: number
    scope: MandatoryChargeScope; scopeLevel: AcademicLevel | null; scopeGrade: Grade | null; scopeCourseId: number | null
  }) {
    return prisma.mandatoryCharge.create({ data })
  },

  toggle(id: number, isActive: boolean) {
    return prisma.mandatoryCharge.update({ where: { id }, data: { isActive } })
  },

  update(id: number, data: Partial<{
    title: string; description: string | null; amount: number; type: any; dueDate: Date | null
    scope: MandatoryChargeScope; scopeLevel: AcademicLevel | null; scopeGrade: Grade | null; scopeCourseId: number | null
  }>) {
    return prisma.mandatoryCharge.update({ where: { id }, data })
  },

  findActiveForYear(schoolId: number, academicYearId: number) {
    return prisma.mandatoryCharge.findMany({ where: { schoolId, academicYearId, isActive: true } })
  },

  // Tutores del colegio (isTutor:true de un estudiante con matrícula activa
  // en la gestión de la plantilla, DENTRO del alcance de la plantilla) que
  // TODAVÍA no tienen un Charge generado desde esta plantilla — la base
  // tanto de "aplicar a faltantes" como de la aplicación automática a un
  // tutor nuevo. El chequeo de matrícula evita generar el cargo a un tutor
  // cuyo único hijo ya no está inscrito ese año (ej. casos "Grupo C" — ver
  // CLAUDE.md 19.2.3). Sigue siendo una sola consulta — el alcance es una
  // condición anidada más, no un loop aparte.
  // `type`+`title`: CUOTA_INICIAL es el único type con la invariante real
  // "uno solo por CONCEPTO por tutor por gestión" (ver hallazgo del bug
  // "Aporte BTH 2026" — se pudo crear 2 veces el mismo aporte, una desde
  // Nuevo Cargo y otra desde acá, sin ningún chequeo cruzado). Para ese
  // type, además de excluir a quien ya tiene un Charge de ESTA plantilla
  // puntual, se excluye a quien ya tiene CUALQUIER Charge activo (no
  // anulado, no traslado) con TÍTULO EQUIVALENTE (normalizeChargeTitle) en
  // la gestión — venga de donde venga. Comparar por título, no solo type:
  // "Cuota Inicial de Inscripción" y "Aporte BTH 2026" son 2 conceptos
  // reales distintos, ambos CUOTA_INICIAL, que sí coexisten para el mismo
  // tutor — filtrar solo por type los hubiera confundido. Se resuelve en 2
  // consultas (nunca N+1: la segunda es un solo IN sobre los candidatos de
  // la primera, sin importar cuántos sean). MULTA_ASAMBLEA/MULTA_REUNION
  // (y el resto) nunca entran en la segunda consulta: se generan
  // legítimamente más de una vez por gestión (una multa por cada
  // asamblea/reunión faltada — ver convocatoria.service.ts/meeting.repository.ts).
  async findTutorsMissingCharge(
    schoolId: number, mandatoryChargeId: number, academicYearId: number, type: ChargeType, title: string,
    scope: { scope: MandatoryChargeScope; scopeLevel: AcademicLevel | null; scopeGrade: Grade | null; scopeCourseId: number | null },
    onlyParentId?: number,
  ) {
    const candidates = await prisma.parent.findMany({
      where: {
        schoolId,
        students: { some: { isTutor: true, student: { assignments: { some: { academicYearId, ...scopeToCourseWhere(scope) } } } } },
        charges: { none: { mandatoryChargeId } },
        ...(onlyParentId ? { id: onlyParentId } : {}),
      },
      select: { id: true },
    })
    if (type !== 'CUOTA_INICIAL' || candidates.length === 0) return candidates

    const existing = await prisma.charge.findMany({
      where: {
        parentId: { in: candidates.map((c) => c.id) },
        type: 'CUOTA_INICIAL', academicYearId, sourceChargeId: null, status: { not: 'ANULADO' },
      },
      select: { parentId: true, title: true },
    })
    const target = normalizeChargeTitle(title)
    const alreadyHas = new Set(existing.filter((c) => normalizeChargeTitle(c.title) === target).map((c) => c.parentId))
    return candidates.filter((c) => !alreadyHas.has(c.id))
  },

  // skipDuplicates: red de seguridad ante una condición de carrera con el
  // índice único parcial de CUOTA_INICIAL — el chequeo explícito en
  // findTutorsMissingCharge ya filtra casi todo, esto solo cubre la ventana
  // entre chequeo e insert si 2 requests corren en simultáneo.
  createChargesForParents(mandatoryChargeId: number, parentIds: number[], data: { title: string; amount: number; type: any; dueDate: Date | null; academicYearId: number; schoolId: number }) {
    return prisma.charge.createMany({
      data: parentIds.map((parentId) => ({ ...data, parentId, mandatoryChargeId, target: 'TUTOR' as const })),
      skipDuplicates: true,
    })
  },

  countChargesWithPayments(mandatoryChargeId: number) {
    return prisma.charge.count({ where: { mandatoryChargeId, payments: { some: {} } } })
  },

  // Foto completa de la plantilla + todo lo que generó, para guardar en
  // AuditLog.before ANTES de borrar — es la única forma de poder reconstruir
  // qué se perdió, dado que después no queda ningún rastro (ver CLAUDE.md
  // 17.1). Solo campos con valor real, no el registro completo.
  findSnapshotForDelete(mandatoryChargeId: number) {
    return prisma.mandatoryCharge.findUnique({
      where: { id: mandatoryChargeId },
      select: {
        id: true, title: true, amount: true, type: true, academicYearId: true,
        scope: true, scopeLevel: true, scopeGrade: true, scopeCourseId: true,
        charges: {
          select: {
            id: true, parentId: true, amount: true, paidAmount: true, status: true,
            payments: { select: { id: true, amount: true, reference: true } },
          },
        },
      },
    })
  },

  // Borra la plantilla Y todo lo que generó — a diferencia de toggle
  // (desactivar), esto es permanente: se usa para el caso de una plantilla
  // creada por error que nunca debió aplicarse (ver "Aporte BTH 2025"
  // mal-etiquetada bajo la gestión equivocada). Primero los Payment de esos
  // Charge (si hubiera), después los Charge, después la plantilla. `tx`
  // explícito (no abre su propia transacción) para que el service pueda
  // loguear el AuditLog en la misma transacción — mismo patrón que
  // parent.service.ts usa para deleteParent.
  deletePaymentsTx(tx: TxClient, mandatoryChargeId: number) {
    return tx.payment.deleteMany({ where: { charge: { mandatoryChargeId } } })
  },

  deleteChargesTx(tx: TxClient, mandatoryChargeId: number) {
    return tx.charge.deleteMany({ where: { mandatoryChargeId } })
  },

  deleteTemplateTx(tx: TxClient, mandatoryChargeId: number) {
    return tx.mandatoryCharge.delete({ where: { id: mandatoryChargeId } })
  },
}

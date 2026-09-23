import { Prisma, ChargeStatus, PaymentMethod } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'
import { Pagination, paginationArgs } from '../utils/pagination'
import { normalizeChargeTitle } from '../utils/charge-concept'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const treasuryRepository = {
  findCharges(where: Prisma.ChargeWhereInput, pagination?: Pagination) {
    return prisma.charge.findMany({
      where,
      include: {
        parent:       { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } },
        student:      { select: { id: true, firstName: true, lastName: true, ci: true } },
        academicYear: { select: { id: true, year: true } },
        payments:     { orderBy: { date: 'desc' } },
        _count:       { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(pagination),
    })
  },

  findChargeById(id: number) {
    return prisma.charge.findUnique({
      where: { id },
      include: {
        parent:       { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } },
        student:      { select: { id: true, firstName: true, lastName: true, ci: true } },
        academicYear: { select: { id: true, year: true } },
        payments:     { orderBy: { date: 'desc' } },
      },
    })
  },

  findChargeRaw(id: number) {
    return prisma.charge.findUnique({ where: { id } })
  },

  findChargeWithPayments(id: number) {
    return prisma.charge.findUnique({ where: { id }, include: { payments: true } })
  },

  findParentForAccount(parentId: number) {
    return prisma.parent.findUnique({
      where: { id: parentId },
      select: {
        id: true, firstName: true, lastName: true, ci: true, phone: true, kardex: true,
        students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    })
  },

  findChargesByParent(parentId: number) {
    return prisma.charge.findMany({
      where: { parentId },
      include: {
        student:      { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { year: true } },
        payments:     { orderBy: { date: 'desc' } },
        refunds:      { select: { amount: true, reason: true, date: true }, orderBy: { date: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findParentRaw(id: number) {
    return prisma.parent.findUnique({ where: { id } })
  },

  findStudentRaw(id: number) {
    return prisma.student.findUnique({ where: { id } })
  },

  // Unchecked (FKs escalares) a propósito: el motor de tenant-scoping fuerza
  // `data.schoolId` como escalar para un actor de alcance colegio — mezclar
  // eso con `school: {connect}}` hace que Prisma rechace el create ("Unknown
  // argument schoolId"). Con Unchecked no hay conflicto (mismo fix que ya se
  // aplicó en junta.repository.ts/parent.repository.ts).
  createCharge(data: Prisma.ChargeUncheckedCreateInput) {
    return prisma.charge.create({
      data,
      include: {
        parent:       { select: { id: true, firstName: true, lastName: true } },
        student:      { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { year: true } },
      },
    })
  },

  createChargeRaw(data: Prisma.ChargeUncheckedCreateInput) {
    return prisma.charge.create({ data })
  },

  updateCharge(id: number, data: Prisma.ChargeUpdateInput) {
    return prisma.charge.update({
      where: { id }, data,
      include: {
        parent:  { select: { id: true, firstName: true, lastName: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  },

  setChargeStatus(id: number, status: ChargeStatus, tx?: TxClient) {
    return (tx ?? prisma).charge.update({ where: { id }, data: { status } })
  },

  // Tutores del lote que YA tienen un cargo activo (no anulado, no
  // traslado) del mismo CONCEPTO -- type=CUOTA_INICIAL Y título equivalente
  // (normalizeChargeTitle, para que "Aporte BTH2026" y "Aporte BTH 2026"
  // matcheen). Solo título exacto normalizado, NUNCA solo `type`: en este
  // colegio "Cuota Inicial de Inscripción" y "Aporte BTH 2026" son 2
  // conceptos reales distintos que coexisten para el mismo tutor, ambos
  // CUOTA_INICIAL -- filtrar solo por type los hubiera confundido. Usado
  // solo para CUOTA_INICIAL (ver createBulkCharges/mandatoryCharge): es el
  // único type con la invariante real "uno solo por concepto por tutor por
  // año". MULTA_ASAMBLEA/MULTA_REUNION se generan legítimamente más de una
  // vez por gestión (una multa por cada asamblea/reunión faltada — ver
  // convocatoria.service.ts/meeting.repository.ts), nunca se les aplica.
  async findParentIdsWithSameCuotaInicial(parentIds: number[], title: string, academicYearId: number): Promise<number[]> {
    if (parentIds.length === 0) return []
    const rows = await prisma.charge.findMany({
      where: { parentId: { in: parentIds }, type: 'CUOTA_INICIAL', academicYearId, sourceChargeId: null, status: { not: 'ANULADO' } },
      select: { parentId: true, title: true },
    })
    const target = normalizeChargeTitle(title)
    return [...new Set(rows.filter((r) => normalizeChargeTitle(r.title) === target).map((r) => r.parentId))]
  },

  setChargePaid(id: number, paidAmount: number, status: ChargeStatus) {
    return prisma.charge.update({ where: { id }, data: { paidAmount, status } })
  },

  createPayment(data: { amount: number; method: PaymentMethod; reference: string | null; note: string | null; date: Date; chargeId: number; parentId: number }) {
    return prisma.payment.create({ data: { ...data, schoolId: getTenantContext()?.schoolId ?? 0 } })
  },

  findPaymentById(id: number) {
    return prisma.payment.findUnique({ where: { id }, include: { charge: { include: { payments: true } } } })
  },

  findPaymentByReference(reference: string) {
    return prisma.payment.findFirst({ where: { reference } })
  },

  // El aporte es por TUTOR (no por estudiante) — un mismo tutor con 2 hijos ya
  // tiene UN solo cargo por concepto/gestión, sin importar desde qué fila
  // (hijo) se lo mire. Antes de crear un cargo histórico hay que confirmar
  // que no exista ya uno para ese tutor+plantilla+gestión, si no un hermano
  // en otro curso terminaría generando un segundo cargo duplicado para la
  // misma familia.
  findChargeByParentTemplate(parentId: number, academicYearId: number, mandatoryChargeId: number) {
    return prisma.charge.findFirst({ where: { parentId, academicYearId, mandatoryChargeId } })
  },

  // Base de la corrección histórica — trae el/los Payment del cargo y, si es
  // un TRASLADADO (ANULADO con carriedCharges), el cargo derivado en la
  // gestión siguiente con su propio conteo de pagos (para decidir si es
  // seguro re-sincronizar su monto o si ya tiene actividad propia en 2026).
  findChargeForCorrection(id: number) {
    return prisma.charge.findUnique({
      where: { id },
      include: {
        payments: true,
        carriedCharges: { select: { id: true, amount: true, paidAmount: true, status: true, academicYear: { select: { year: true } }, _count: { select: { payments: true } } } },
      },
    })
  },

  updatePayment(id: number, data: { amount?: number; method?: PaymentMethod; reference?: string | null; note?: string | null; date?: Date }) {
    return prisma.payment.update({ where: { id }, data })
  },

  // Base para registrar una devolución — trae el cargo con sus devoluciones
  // ya registradas, para validar el monto disponible (paidAmount menos lo ya
  // devuelto) antes de crear una nueva.
  findChargeWithRefunds(id: number) {
    return prisma.charge.findUnique({
      where: { id },
      include: { refunds: { orderBy: { date: 'desc' } } },
    })
  },

  createRefund(data: { amount: number; date: Date; reason: string; chargeId: number; handledById: number | null; schoolId: number }) {
    return prisma.refund.create({ data })
  },

  findChargesForSummary(where: Prisma.ChargeWhereInput) {
    return prisma.charge.findMany({ where, select: { amount: true, paidAmount: true, status: true, type: true } })
  },

  findParentsWithCharges(where: Prisma.ParentWhereInput, academicYearId?: number) {
    return prisma.parent.findMany({
      // Todo cargo va al tutor designado — un padre/madre sin isTutor:true no
      // es un sujeto de cobro, así que no tiene sentido ofrecerlo acá (ni en el
      // listado de tesorería ni en los selectores de "Nuevo Cargo", que
      // reusan este mismo método).
      where: { ...where, students: { some: { isTutor: true } } },
      include: {
        students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
        charges: {
          where: { status: { not: 'ANULADO' }, ...(academicYearId ? { academicYearId } : {}) },
          select: { amount: true, paidAmount: true, status: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  },

  isParentTutor(parentId: number) {
    return prisma.parentStudent.findFirst({ where: { parentId, isTutor: true } })
  },

  // Version en lote de isParentTutor — una sola consulta para todo el
  // lote en vez de una por parentId (ver createBulkCharges).
  async findTutorParentIds(parentIds: number[]): Promise<number[]> {
    const rows = await prisma.parentStudent.findMany({
      where: { parentId: { in: parentIds }, isTutor: true },
      select: { parentId: true },
      distinct: ['parentId'],
    })
    return rows.map((r) => r.parentId)
  },

  // Insert masivo — createBulkCharges ya valida tutoria/alcance de DELEGATE
  // antes de llamar acá, así que esto solo inserta lo ya aprobado.
  // skipDuplicates: red de seguridad ante una condición de carrera con el
  // índice único parcial de CUOTA_INICIAL (ver migración
  // add_charge_unique_cuota_inicial_per_year) — el chequeo explícito en el
  // service ya filtra casi todo, esto solo cubre la ventana entre chequeo e
  // insert si 2 requests corren en simultáneo.
  createManyChargesRaw(data: Prisma.ChargeUncheckedCreateInput[]) {
    return prisma.charge.createMany({ data, skipDuplicates: true })
  },

  // Estudiantes vinculados a un tutor — usado por assertDelegateOwnsParent
  // para confirmar que el tutor pertenece al curso del delegado que actúa.
  async findParentStudentIds(parentId: number): Promise<number[]> {
    const relations = await prisma.parentStudent.findMany({ where: { parentId }, select: { studentId: true } })
    return relations.map((r) => r.studentId)
  },

  // Historial de pagos — lista plana de Payment (no anidada en la cuenta de
  // un tutor), del más reciente al más antiguo. Trae también la gestión del
  // cargo y el/los estudiante(s) relacionados — para un cargo por ESTUDIANTE
  // ya viene el específico (charge.student); para uno por TUTOR (la mayoría,
  // ej. Aporte/BTH) no hay uno solo, se resuelve del lado del cliente con los
  // hijos que ese tutor tiene a cargo (parent.students).
  findAllPayments() {
    return prisma.payment.findMany({
      include: {
        parent: {
          select: {
            id: true, firstName: true, lastName: true, ci: true,
            students: { where: { isTutor: true }, select: { student: { select: { firstName: true, lastName: true } } } },
          },
        },
        charge: {
          select: {
            id: true, title: true, type: true, target: true,
            academicYear: { select: { year: true } },
            student: { select: { firstName: true, lastName: true } },
            refunds: { select: { amount: true, reason: true, date: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })
  },

  // Agrupa los cargos del colegio por curso, para la vista "Por curso" de
  // Tesorería — Course -> asignaciones del año activo -> estudiante -> padres
  // tutores -> sus cargos, en una sola consulta (evita el patrón N+1 que usa
  // hoy el Delegado, que solo escala para 1 curso a la vez).
  // courseId opcional — lo usa DELEGATE para acotar el resultado a su propio
  // curso (ver treasuryService.getTreasuryByCourse).
  findChargesGroupedByCourse(schoolId: number, academicYearId: number, courseId?: number) {
    return prisma.course.findMany({
      where: { schoolId, ...(courseId ? { id: courseId } : {}) },
      include: {
        assignments: {
          where: { academicYearId },
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true,
                parents: {
                  where: { isTutor: true },
                  include: {
                    parent: {
                      select: {
                        id: true, firstName: true, lastName: true, ci: true, phone: true, kardex: true,
                        charges: {
                          where: { status: { not: 'ANULADO' }, academicYearId },
                          select: { id: true, title: true, type: true, amount: true, paidAmount: true, status: true, studentId: true, dueDate: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }],
    })
  },

  // Plantillas de la gestión a verificar — sin filtrar por isActive, porque una
  // gestión histórica (ej. 2025) ya cerrada tiene sus plantillas desactivadas
  // pero siguen siendo las columnas que el reporte de verificación necesita.
  findMandatoryChargesForYear(schoolId: number, academicYearId: number) {
    return prisma.mandatoryCharge.findMany({
      where: { schoolId, academicYearId },
      select: { id: true, title: true, type: true, amount: true },
      orderBy: { id: 'asc' },
    })
  },

  // Base del reporte de verificación por curso — a diferencia de
  // findChargesGroupedByCourse (que agrupa por tutor y lo dedupea), acá se
  // necesita una fila por ESTUDIANTE para poder cruzar visualmente contra una
  // planilla externa curso por curso, aunque el mismo tutor se repita entre
  // hermanos.
  findVerificationByCourse(schoolId: number, academicYearId: number, courseId?: number) {
    return prisma.course.findMany({
      where: { schoolId, ...(courseId ? { id: courseId } : {}) },
      include: {
        assignments: {
          where: { academicYearId },
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true, isActive: true,
                parents: {
                  where: { isTutor: true },
                  include: {
                    parent: {
                      select: {
                        id: true, firstName: true, lastName: true, ci: true, kardex: true,
                        // Sin filtro de status a propósito -- un cargo ANULADO
                        // (por traslado de cierre económico, O por cancelación
                        // manual vía "Cancelar cargo") sigue siendo relevante
                        // para la auditoría, se muestra con su propio estado en
                        // vez de desaparecer como si nunca se hubiera cobrado.
                        // carriedCharges no vacío distingue traslado de
                        // cancelación manual (ver getVerificationReportByCourse),
                        // ver también [[junta-escolar-cierre-economico-2025]].
                        charges: {
                          where: { academicYearId },
                          select: {
                            id: true, mandatoryChargeId: true, amount: true, paidAmount: true, status: true, pendingVerificationNote: true,
                            carriedCharges: { select: { id: true, status: true, academicYear: { select: { year: true } } } },
                            payments: { select: { reference: true }, orderBy: { date: 'asc' } },
                            refunds: { select: { amount: true, reason: true, date: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }],
    })
  },
}

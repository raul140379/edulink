import { Prisma, ChargeStatus, PaymentMethod } from '@prisma/client'
import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const treasuryRepository = {
  findCharges(where: Prisma.ChargeWhereInput) {
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
        id: true, firstName: true, lastName: true, ci: true, phone: true,
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

  setChargeStatus(id: number, status: ChargeStatus) {
    return prisma.charge.update({ where: { id }, data: { status } })
  },

  setChargePaid(id: number, paidAmount: number, status: ChargeStatus) {
    return prisma.charge.update({ where: { id }, data: { paidAmount, status } })
  },

  createPayment(data: { amount: number; method: PaymentMethod; reference: string | null; note: string | null; date: Date; chargeId: number; parentId: number }) {
    return prisma.payment.create({ data: { ...data, schoolId: getTenantContext()?.schoolId ?? 0 } })
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

  // Agrupa los cargos del colegio por curso, para la vista "Por curso" de
  // Tesorería — Course -> asignaciones del año activo -> estudiante -> padres
  // tutores -> sus cargos, en una sola consulta (evita el patrón N+1 que usa
  // hoy el Delegado, que solo escala para 1 curso a la vez).
  findChargesGroupedByCourse(schoolId: number, academicYearId: number) {
    return prisma.course.findMany({
      where: { schoolId },
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
                        id: true, firstName: true, lastName: true, ci: true, phone: true,
                        charges: {
                          where: { status: { not: 'ANULADO' }, academicYearId },
                          select: { id: true, amount: true, paidAmount: true, status: true, studentId: true },
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

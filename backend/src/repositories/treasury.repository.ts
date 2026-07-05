import { Prisma, ChargeStatus, PaymentMethod } from '@prisma/client'
import prisma from '../lib/prisma'

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

  createCharge(data: Prisma.ChargeCreateInput) {
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
    return prisma.payment.create({ data })
  },

  findChargesForSummary(where: Prisma.ChargeWhereInput) {
    return prisma.charge.findMany({ where, select: { amount: true, paidAmount: true, status: true, type: true } })
  },

  findParentsWithCharges(where: Prisma.ParentWhereInput, academicYearId?: number) {
    return prisma.parent.findMany({
      where,
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
}

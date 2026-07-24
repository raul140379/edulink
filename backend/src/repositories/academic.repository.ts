import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const academicRepository = {
  findAllYears() {
    return prisma.academicYear.findMany({
      include: { _count: { select: { trimesters: true, assignments: true, holidays: true } } },
      orderBy: { year: 'desc' },
    })
  },

  findActiveYear() {
    return prisma.academicYear.findFirst({
      where: { isActive: true },
      include: {
        trimesters: { orderBy: { number: 'asc' } },
        holidays:   { orderBy: { date: 'asc' } },
      },
    })
  },

  findYearByYear(year: number) {
    return prisma.academicYear.findFirst({ where: { year } })
  },

  findYearById(id: number) {
    return prisma.academicYear.findUnique({ where: { id } })
  },

  createYear(data: { year: number; startDate: Date; endDate: Date }) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.academicYear.create({ data: { ...data, isActive: false, schoolId: getTenantContext()?.schoolId ?? 0 } })
  },

  updateYear(id: number, data: { startDate?: Date; endDate?: Date }) {
    return prisma.academicYear.update({ where: { id }, data })
  },

  deactivateAllYears() {
    return prisma.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } })
  },

  setYearActive(id: number, isActive: boolean) {
    return prisma.academicYear.update({ where: { id }, data: { isActive } })
  },

  findTrimestersByYear(academicYearId: number) {
    return prisma.trimester.findMany({ where: { academicYearId }, orderBy: { number: 'asc' } })
  },

  findTrimesterByYearAndNumber(academicYearId: number, number: number) {
    return prisma.trimester.findUnique({ where: { academicYearId_number: { academicYearId, number } } })
  },

  createTrimester(data: { number: number; name: string; startDate: Date; endDate: Date; academicYearId: number; isClosed: boolean }) {
    return prisma.trimester.create({ data })
  },

  findTrimesterById(id: number) {
    return prisma.trimester.findUnique({
      where: { id },
      include: { academicYear: { include: { trimesters: { orderBy: { number: 'asc' } } } } },
    })
  },

  updateTrimesterClosed(id: number, isClosed: boolean) {
    return prisma.trimester.update({ where: { id }, data: { isClosed } })
  },

  findHolidaysByYear(academicYearId: number) {
    return prisma.holiday.findMany({ where: { academicYearId }, orderBy: { date: 'asc' } })
  },

  createHoliday(data: { date: Date; description: string; academicYearId: number }) {
    return prisma.holiday.create({ data })
  },

  deleteHoliday(id: number) {
    return prisma.holiday.delete({ where: { id } })
  },
}

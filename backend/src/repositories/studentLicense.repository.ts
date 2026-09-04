import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const studentLicenseRepository = {
  create(data: { studentId: number; startDate: Date; endDate: Date; reason: string | null; createdById: number }) {
    return prisma.studentLicense.create({
      data: {
        studentId: data.studentId, startDate: data.startDate, endDate: data.endDate,
        reason: data.reason, createdById: data.createdById,
        schoolId: getTenantContext()?.schoolId ?? 0,
      },
    })
  },

  findStudentById(id: number) {
    return prisma.student.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } })
  },
}

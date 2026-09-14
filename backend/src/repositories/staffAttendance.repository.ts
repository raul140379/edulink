import prisma from '../lib/prisma'

export const staffAttendanceRepository = {
  findReport(where: any) {
    return prisma.staffAttendance.findMany({
      where,
      include: { staff: { select: { id: true, firstName: true, lastName: true, ci: true, phone: true, staffRole: true, entryTime: true } } },
      orderBy: [{ staff: { lastName: 'asc' } }, { date: 'asc' }],
    })
  },
}

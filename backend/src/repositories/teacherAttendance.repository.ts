import prisma from '../lib/prisma'

export const teacherAttendanceRepository = {
  findTeacherByUserId(userId: number | undefined) {
    return prisma.teacher.findFirst({ where: { OR: [{ userId }, { tutorUserId: userId }] } })
  },

  findEntryConfig(teacherId: number) {
    return prisma.teacher.findUnique({ where: { id: teacherId }, select: { entryTime: true, toleranceMin: true } })
  },

  findTeacherByAttendanceCode(code: string) {
    return prisma.teacher.findUnique({
      where: { attendanceCode: code },
      select: { id: true, firstName: true, lastName: true, entryTime: true, toleranceMin: true },
    })
  },

  findTodayFor(teacherId: number, start: Date, end: Date) {
    return prisma.teacherAttendance.findFirst({ where: { teacherId, date: { gte: start, lte: end } } })
  },

  create(teacherId: number, date: Date, checkIn: Date, status: string) {
    return prisma.teacherAttendance.create({ data: { teacherId, date, checkIn, status: status as any } })
  },

  updateCheckIn(id: number, checkIn: Date, status: string) {
    return prisma.teacherAttendance.update({ where: { id }, data: { checkIn, status: status as any } })
  },

  updateCheckOut(id: number, checkOut: Date) {
    return prisma.teacherAttendance.update({ where: { id }, data: { checkOut } })
  },

  findHistoryFor(teacherId: number, start: Date, end: Date) {
    return prisma.teacherAttendance.findMany({ where: { teacherId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } })
  },

  findReport(where: any) {
    return prisma.teacherAttendance.findMany({
      where,
      include: { teacher: { select: { id: true, firstName: true, lastName: true, ci: true, phone: true, entryTime: true, exitTime: true } } },
      orderBy: [{ teacher: { lastName: 'asc' } }, { date: 'asc' }],
    })
  },

  update(id: number, data: { status?: string; note?: string; checkIn?: Date; checkOut?: Date }) {
    return prisma.teacherAttendance.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status as any } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.checkIn ? { checkIn: data.checkIn } : {}),
        ...(data.checkOut ? { checkOut: data.checkOut } : {}),
      },
    })
  },

  findActiveTeachers() {
    return prisma.teacher.findMany({ where: { isActive: true } })
  },

  findTeacherIdsWithAttendanceToday(start: Date, end: Date) {
    return prisma.teacherAttendance.findMany({ where: { date: { gte: start, lte: end } }, select: { teacherId: true } })
  },

  createManyAbsent(teacherIds: number[], date: Date) {
    return prisma.teacherAttendance.createMany({
      data: teacherIds.map((teacherId) => ({ teacherId, date, status: 'AUSENTE' as any })),
      skipDuplicates: true,
    })
  },
}

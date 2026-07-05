import prisma from '../lib/prisma'

export const gateRepository = {
  findTeacherByAttendanceCode(code: string) {
    return prisma.teacher.findUnique({
      where: { attendanceCode: code },
      select: { id: true, firstName: true, lastName: true, specialty: true, attendanceCode: true, isActive: true, entryTime: true, exitTime: true },
    })
  },

  findStudentByRude(rude: string) {
    return prisma.student.findUnique({
      where: { rude },
      select: { id: true, firstName: true, lastName: true, rude: true, ci: true, isActive: true },
    })
  },

  findStaffByAttendanceCode(code: string) {
    return prisma.staff.findUnique({
      where: { attendanceCode: code },
      select: { id: true, firstName: true, lastName: true, staffRole: true, attendanceCode: true, isActive: true },
    })
  },

  findStudentById(id: number) {
    return prisma.student.findUnique({ where: { id } })
  },

  findTeacherById(id: number) {
    return prisma.teacher.findUnique({ where: { id } })
  },

  findStaffById(id: number) {
    return prisma.staff.findUnique({ where: { id } })
  },

  findLastGateRecord(where: any) {
    return prisma.gateRecord.findFirst({ where, orderBy: { createdAt: 'desc' } })
  },

  createGateRecord(data: any) {
    return prisma.gateRecord.create({ data })
  },

  createGateRecordWithInclude(data: any, include: any) {
    return prisma.gateRecord.create({ data, include })
  },

  findActiveSchoolSchedule() {
    return prisma.schoolSchedule.findFirst({ where: { isActive: true } })
  },

  findSchedulesForDay(dayOfWeek: number) {
    return prisma.schedule.findMany({
      where: { dayOfWeek, status: { in: ['BORRADOR', 'PUBLICADO'] } },
      select: { teacherSubjectCourse: { select: { teacher: { select: { id: true, firstName: true, lastName: true, ci: true, attendanceCode: true } } } } },
    })
  },

  findSchedulesForDaySimple(dayOfWeek: number) {
    return prisma.schedule.findMany({
      where: { dayOfWeek, status: { in: ['BORRADOR', 'PUBLICADO'] } },
      select: { teacherSubjectCourse: { select: { teacherId: true } } },
    })
  },

  hasPeriodsToday(teacherId: number, dayOfWeek: number) {
    return prisma.schedule.findFirst({
      where: { dayOfWeek, status: { in: ['BORRADOR', 'PUBLICADO'] }, teacherSubjectCourse: { teacherId } },
    })
  },

  findGateRecordsByCriteria(where: any) {
    return prisma.gateRecord.findMany({ where })
  },

  findActiveTeachers() {
    return prisma.teacher.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, ci: true, attendanceCode: true },
    })
  },

  findActiveStaff() {
    return prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, ci: true, staffRole: true, attendanceCode: true },
    })
  },

  findTeacherAttendances(teacherIds: number[], start: Date, end: Date) {
    return prisma.teacherAttendance.findMany({ where: { teacherId: { in: teacherIds }, date: { gte: start, lte: end } } })
  },

  findTeacherAttendanceForDay(teacherId: number, start: Date, end: Date) {
    return prisma.teacherAttendance.findFirst({ where: { teacherId, date: { gte: start, lte: end } } })
  },

  updateTeacherAttendance(id: number, data: any) {
    return prisma.teacherAttendance.update({ where: { id }, data })
  },

  createTeacherAttendance(data: any) {
    return prisma.teacherAttendance.create({ data })
  },

  findGateRecords(where: any, include: any, orderBy: any) {
    return prisma.gateRecord.findMany({ where, include, orderBy })
  },

  findTeachersWithoutCode() {
    return prisma.teacher.findMany({ where: { attendanceCode: null, isActive: true }, select: { id: true, firstName: true, lastName: true } })
  },

  findStaffWithoutCode() {
    return prisma.staff.findMany({ where: { attendanceCode: null, isActive: true }, select: { id: true, firstName: true, lastName: true } })
  },

  findTeacherByCode(code: string) {
    return prisma.teacher.findUnique({ where: { attendanceCode: code } })
  },

  findStaffByCode(code: string) {
    return prisma.staff.findUnique({ where: { attendanceCode: code } })
  },

  updateTeacherCode(id: number, attendanceCode: string) {
    return prisma.teacher.update({ where: { id }, data: { attendanceCode } })
  },

  updateStaffCode(id: number, attendanceCode: string) {
    return prisma.staff.update({ where: { id }, data: { attendanceCode } })
  },

  findAllActiveTeachersWithCodes() {
    return prisma.teacher.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, ci: true, attendanceCode: true },
      orderBy: { lastName: 'asc' },
    })
  },

  findAllActiveStaffWithCodes() {
    return prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, ci: true, staffRole: true, attendanceCode: true },
      orderBy: { lastName: 'asc' },
    })
  },
}

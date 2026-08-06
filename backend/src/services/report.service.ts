import { reportRepository } from '../repositories/report.repository'
import { HttpError } from '../utils/http-error'

export const reportService = {
  getTeachersReport() {
    return reportRepository.findActiveTeachersWithAssignments()
  },

  getDelegatesReport() {
    return reportRepository.findCoursesWithDelegateInfo()
  },

  async getAttendanceReport() {
    const activeYear = await reportRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const meetings = await reportRepository.findMeetingsInDateRange(activeYear.startDate, activeYear.endDate)

    const byCourse = new Map<number, { course: any; totalMeetings: number; present: number; total: number }>()
    for (const m of meetings) {
      if (!byCourse.has(m.courseId)) {
        byCourse.set(m.courseId, { course: m.course, totalMeetings: 0, present: 0, total: 0 })
      }
      const entry = byCourse.get(m.courseId)!
      entry.totalMeetings++
      entry.present += m.attendances.filter((a) => a.present).length
      entry.total += m.attendances.length
    }

    return Array.from(byCourse.values()).map((e) => ({
      course: e.course,
      totalMeetings: e.totalMeetings,
      totalPresent: e.present,
      totalAttendances: e.total,
      presentRate: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
    }))
  },

  async getTreasuryReport(academicYearId?: number) {
    const activeYear = academicYearId
      ? await reportRepository.findAcademicYearById(academicYearId)
      : await reportRepository.findActiveAcademicYear()

    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const charges = await reportRepository.findChargesForYear(activeYear.id)

    const totalCharged = charges.reduce((s, c) => s + c.amount, 0)
    const totalCollected = charges.reduce((s, c) => s + c.paidAmount, 0)
    const totalPending = totalCharged - totalCollected

    const byType = charges.reduce((acc, c) => {
      if (!acc[c.type]) acc[c.type] = { count: 0, charged: 0, collected: 0 }
      acc[c.type].count++
      acc[c.type].charged += c.amount
      acc[c.type].collected += c.paidAmount
      return acc
    }, {} as Record<string, { count: number; charged: number; collected: number }>)

    const byStatus = charges.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const morosos = await reportRepository.findMorosos(activeYear.id)

    return {
      academicYear: activeYear,
      summary: { totalCharged, totalCollected, totalPending },
      byType,
      byStatus,
      morosos: morosos.map((p) => ({
        id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone,
        student: p.students[0]?.student,
        pending: p.charges.reduce((s, c) => s + (c.amount - c.paidAmount), 0),
        charges: p.charges.length,
      })),
    }
  },
}

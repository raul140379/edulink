import { reportRepository } from '../repositories/report.repository'
import { HttpError } from '../utils/http-error'
import { chargeBalance, aggregateChargeBalances } from '../utils/charge-balance'

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

    const { totalDebt: totalCharged, totalPaid: totalCollected, totalPending } = aggregateChargeBalances(charges)

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
        pending: p.charges.reduce((s, c) => s + chargeBalance(c), 0),
        charges: p.charges.length,
      })),
    }
  },

  // Auditoría histórica: qué cargos de una gestión ya cerrada no se pagaron y
  // se trasladaron como Deuda Anterior, y en qué estado quedó ese traslado hoy
  // (puede que el tutor ya lo haya pagado en la gestión siguiente). Sin
  // academicYearId, usa la última gestión cerrada económicamente — no tiene
  // sentido pedir esto de la gestión activa, todavía no se cerró.
  async getCarriedDebtReport(academicYearId?: number) {
    const sourceYear = academicYearId
      ? await reportRepository.findAcademicYearById(academicYearId)
      : await reportRepository.findLastClosedAcademicYear()

    if (!sourceYear) throw new HttpError(404, 'No hay ninguna gestión cerrada económicamente')

    const charges = await reportRepository.findCarriedChargesForYear(sourceYear.id)

    const rows = charges.map((c) => {
      const dest = c.carriedCharges[0]
      return {
        chargeId: c.id, title: c.title, type: c.type, amount: c.amount, paidAmount: c.paidAmount,
        tutor: { id: c.parent.id, firstName: c.parent.firstName, lastName: c.parent.lastName, ci: c.parent.ci, kardex: c.parent.kardex },
        student: c.parent.students[0]?.student ?? null,
        destino: dest ? {
          chargeId: dest.id, academicYearId: dest.academicYearId, year: dest.academicYear.year,
          amount: dest.amount, paidAmount: dest.paidAmount, status: dest.status,
        } : null,
      }
    })

    const totalTrasladado   = rows.reduce((s, r) => s + chargeBalance(r), 0)
    const totalYaResuelto   = rows.filter((r) => r.destino?.status === 'PAGADO').length
    const totalAunPendiente = rows.length - totalYaResuelto

    return {
      sourceAcademicYear: { id: sourceYear.id, year: sourceYear.year },
      totalCasos: rows.length, totalTrasladado, totalYaResuelto, totalAunPendiente,
      rows,
    }
  },
}

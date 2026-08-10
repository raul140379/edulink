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
  //
  // Agrupado por curso del estudiante en la gestión de ORIGEN (mismo criterio
  // que Verificación por Curso), para cruzar contra la planilla física curso
  // por curso. El Charge es por TUTOR, no por hijo — un tutor con hijos en
  // cursos distintos aparece una vez bajo CADA curso (así quien revisa la
  // planilla de un curso específico ve ahí la deuda de esa familia sin tener
  // que adivinar que está bajo otro curso), marcado con `sharedWith` para no
  // confundirlo con un caso independiente. Los totales globales (totalCasos/
  // totalTrasladado/etc.) se calculan sobre los cargos únicos, sin duplicar
  // por este agrupado — a propósito, para no inflar las cifras generales.
  async getCarriedDebtReport(academicYearId?: number) {
    const sourceYear = academicYearId
      ? await reportRepository.findAcademicYearById(academicYearId)
      : await reportRepository.findLastClosedAcademicYear()

    if (!sourceYear) throw new HttpError(404, 'No hay ninguna gestión cerrada económicamente')

    const charges = await reportRepository.findCarriedChargesForYear(sourceYear.id)

    const totalTrasladado   = charges.reduce((s, c) => s + chargeBalance(c), 0)
    const totalYaResuelto   = charges.filter((c) => c.carriedCharges[0]?.status === 'PAGADO').length
    const totalAunPendiente = charges.length - totalYaResuelto

    type CourseInfo = { id: number; level: string; grade: string; parallel: string; shift: string }
    const courseGroups = new Map<string, { course: CourseInfo | null; rows: any[] }>()

    for (const c of charges) {
      const dest = c.carriedCharges[0]
      const destino = dest ? {
        chargeId: dest.id, academicYearId: dest.academicYearId, year: dest.academicYear.year,
        amount: dest.amount, paidAmount: dest.paidAmount, status: dest.status,
      } : null
      const tutor = { id: c.parent.id, firstName: c.parent.firstName, lastName: c.parent.lastName, ci: c.parent.ci, kardex: c.parent.kardex }

      // Un mismo curso no se repite aunque 2 hermanos compartan curso — solo
      // interesa la LISTA de cursos distintos donde este tutor tiene hijos
      // con este cargo trasladado.
      const byCourse = new Map<number, { student: { firstName: string; lastName: string }; course: CourseInfo }>()
      for (const ps of c.parent.students) {
        const course = ps.student.assignments[0]?.course
        if (course && !byCourse.has(course.id)) {
          byCourse.set(course.id, { student: { firstName: ps.student.firstName, lastName: ps.student.lastName }, course })
        }
      }

      if (byCourse.size === 0) {
        // Ningún hijo tutorado tiene matrícula registrada en la gestión de
        // origen (dato incompleto) — va a un bucket aparte, no se pierde.
        const key = 'sin-curso'
        if (!courseGroups.has(key)) courseGroups.set(key, { course: null, rows: [] })
        courseGroups.get(key)!.rows.push({
          chargeId: c.id, title: c.title, type: c.type, amount: c.amount, paidAmount: c.paidAmount,
          tutor, student: null, destino,
        })
        continue
      }

      const entries = Array.from(byCourse.values())
      for (const { student, course } of entries) {
        const sharedWith = entries
          .filter((e) => e.course.id !== course.id)
          .map((e) => ({ grade: e.course.grade, parallel: e.course.parallel, shift: e.course.shift }))

        const key = String(course.id)
        if (!courseGroups.has(key)) courseGroups.set(key, { course, rows: [] })
        courseGroups.get(key)!.rows.push({
          chargeId: c.id, title: c.title, type: c.type, amount: c.amount, paidAmount: c.paidAmount,
          tutor, student, destino,
          ...(sharedWith.length > 0 ? { sharedWith } : {}),
        })
      }
    }

    // Mismo orden que Verificación por Curso: nivel/grado/paralelo — Grade no
    // ordena alfabéticamente bien (PRIMERO > SEGUNDO como texto), así que se
    // usa el orden real de la malla curricular.
    const GRADE_ORDER = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO']
    const courses = Array.from(courseGroups.values()).sort((a, b) => {
      if (!a.course) return 1
      if (!b.course) return -1
      if (a.course.level !== b.course.level) return a.course.level.localeCompare(b.course.level)
      const byGrade = GRADE_ORDER.indexOf(a.course.grade) - GRADE_ORDER.indexOf(b.course.grade)
      if (byGrade !== 0) return byGrade
      return a.course.parallel.localeCompare(b.course.parallel)
    })
    for (const group of courses) {
      group.rows.sort((a, b) => `${a.student?.lastName} ${a.student?.firstName}`.localeCompare(`${b.student?.lastName} ${b.student?.firstName}`, 'es'))
    }

    return {
      sourceAcademicYear: { id: sourceYear.id, year: sourceYear.year },
      totalCasos: charges.length, totalTrasladado, totalYaResuelto, totalAunPendiente,
      courses,
    }
  },
}

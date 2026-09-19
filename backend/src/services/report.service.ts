import { reportRepository } from '../repositories/report.repository'
import { HttpError } from '../utils/http-error'
import { chargeBalance, aggregateChargeBalances } from '../utils/charge-balance'
import { Pagination, withTotal } from '../utils/pagination'
import { dayRange, dayOfWeekFromBase } from './studentAttendance.service'
import { groupIntoBlocks, AttendanceBlockRange } from '../utils/attendance-blocks'
import { collapseToDailyStatus } from '../utils/attendance-daily-status'

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

  // Reporte diario de cumplimiento (Administración → Reportes) — 2 consultas
  // totales sin importar cuántos cursos haya: todos los cursos del colegio +
  // toda la asistencia de ese día, agrupada en memoria por courseId. Nunca
  // una consulta por curso.
  async getDailyAttendanceCompliance(date?: string) {
    const activeYear = await reportRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const { base, next } = dayRange(date)
    const [courses, attendances, allAssignments] = await Promise.all([
      reportRepository.findAllCoursesForSchool(),
      reportRepository.findAttendancesForSchoolDate(activeYear.id, base, next),
      reportRepository.findAllAssignmentsForSchool(activeYear.id),
    ])

    // Dedupe por estudiante (4-sep-2026): con teacherId en la clave única de
    // StudentAttendance, un curso con varios maestros puede tener más de una
    // fila por estudiante el mismo día — sin esto, "presentes" contaría cada
    // fila en vez de cada estudiante (37 alumnos podría mostrar 74). Se
    // queda con la más reciente por estudiante (attendances ya viene
    // ordenado updatedAt desc). El bucket usa el courseId PROPIO de la fila
    // (congelado al guardar) — nunca el curso actual del estudiante, para no
    // reatribuír asistencia histórica si después cambió de curso.
    const seen = new Set<string>()
    const withRealRow = new Set<number>()
    const byCourse = new Map<number, { presentes: number; ausentes: number; retrasos: number; licencias: number }>()
    for (const a of attendances) {
      const key = `${a.courseId}-${a.studentId}`
      if (seen.has(key)) continue
      seen.add(key)
      withRealRow.add(a.studentId)

      if (!byCourse.has(a.courseId)) byCourse.set(a.courseId, { presentes: 0, ausentes: 0, retrasos: 0, licencias: 0 })
      const entry = byCourse.get(a.courseId)!
      if (a.status === 'PRESENTE') entry.presentes++
      else if (a.status === 'AUSENTE') entry.ausentes++
      else if (a.status === 'RETRASO') entry.retrasos++
      else if (a.status === 'LICENCIA') entry.licencias++
    }

    // Licencias (12-sep-2026, hueco cerrado): un estudiante con licencia
    // activa hoy y SIN ninguna fila real todavía cuenta como "licencia" en
    // su curso ACTUAL — antes no se contaba en absoluto (ni presente, ni
    // ausente, ni licencia: invisible). Si ya tiene una fila real de otro
    // día/maestro, esa fila real manda (mismo criterio de "nunca perder el
    // histórico" — acá no hay ambigüedad de curso para pisar, a diferencia
    // de getAttendanceByCourse que es de un solo curso).
    const studentIds = allAssignments.map((a) => a.studentId)
    const licenses = await reportRepository.findActiveLicensesForStudents(studentIds, base)
    const courseByStudent = new Map(allAssignments.map((a) => [a.studentId, a.courseId]))
    for (const lic of licenses) {
      if (withRealRow.has(lic.studentId)) continue
      const courseId = courseByStudent.get(lic.studentId)
      if (courseId === undefined) continue
      if (!byCourse.has(courseId)) byCourse.set(courseId, { presentes: 0, ausentes: 0, retrasos: 0, licencias: 0 })
      byCourse.get(courseId)!.licencias++
    }

    return {
      date: base.toISOString().split('T')[0],
      courses: courses.map((c) => {
        const entry = byCourse.get(c.id)
        const total = entry ? entry.presentes + entry.ausentes + entry.retrasos + entry.licencias : 0
        return {
          course: c,
          registrado: total > 0,
          totalEstudiantes: total,
          presentes: entry?.presentes ?? 0,
          ausentes: entry?.ausentes ?? 0,
          retrasos: entry?.retrasos ?? 0,
          licencias: entry?.licencias ?? 0,
        }
      }),
    }
  },

  // Detalle de un curso — bajo demanda (solo cuando se hace clic en ESE
  // curso puntual, nunca los ~18 de una). A propósito SIN
  // resolveAttendanceWindow (esa lógica es para validar que se puede
  // GUARDAR asistencia, no para consultar un historial) — reusarla rompería
  // para REGENTE, que tiene ATTENDANCE_VIEW pero no fila Teacher propia y no
  // está exento ahí como sí lo están DIRECTOR/SECRETARY.
  async getDailyAttendanceCourseDetail(courseId: number, date?: string) {
    const activeYear = await reportRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const course = await reportRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const { base, next } = dayRange(date)
    const [assignments, attendances] = await Promise.all([
      reportRepository.findAssignmentsForCourse(courseId, activeYear.id),
      reportRepository.findAttendancesForCourseDateWithTeacher(courseId, activeYear.id, base, next),
    ])

    // Primero-visto-gana (4-sep-2026): attendances viene ordenado updatedAt
    // desc — con teacherId en la clave única, un estudiante puede tener
    // varias filas (una por maestro) el mismo día; sin este orden de
    // asignación, un forEach normal sobreescribe con la ÚLTIMA fila
    // procesada (la más VIEJA), al revés de lo que se quiere mostrar.
    const attendanceMap: Record<number, (typeof attendances)[number]> = {}
    attendances.forEach((a) => { if (!attendanceMap[a.studentId]) attendanceMap[a.studentId] = a })

    const teacherName = attendances[0]?.teacher
      ? `${attendances[0].teacher.firstName} ${attendances[0].teacher.lastName}`
      : null

    // Licencias (12-sep-2026, hueco cerrado): mismo criterio que
    // getAttendanceByCourse — la licencia TAPA el estado de quien la tenga
    // activa hoy, sin importar si ya había una fila real (nunca se toca esa
    // fila, solo se ignora para esta vista/conteo). Curso único acá, así que
    // no hay ambigüedad de a qué curso atribuirla.
    const licenses = await reportRepository.findActiveLicensesForStudents(assignments.map((a) => a.student.id), base)
    const licenseByStudent = new Map(licenses.map((l) => [l.studentId, l.reason]))

    return {
      date: base.toISOString().split('T')[0],
      course,
      teacherName,
      registrado: attendances.length > 0,
      students: assignments.map((a) => {
        const onLicense = licenseByStudent.has(a.student.id)
        return {
          studentId: a.student.id,
          firstName: a.student.firstName,
          lastName:  a.student.lastName,
          gender:    a.student.gender,
          status:    onLicense ? 'LICENCIA' : (attendanceMap[a.student.id]?.status ?? null),
          onLicense,
        }
      }),
    }
  },

  // Matriz semanal (5-sep-2026, aprobada — ver CLAUDE.md): 5 consultas
  // totales sin importar cuántos bloques tenga la semana (horario completo +
  // AttendanceBlock reales + roster + asistencia de esos bloques +
  // licencias), nunca una por día/bloque. Sin PDF/frontend todavía — eso se
  // diseña con maqueta aparte, como se acordó.
  //
  // Bloques ESPERADOS: se agrupan primero por (día, maestro) — groupIntoBlocks
  // espera los períodos de UN SOLO maestro (mismo contrato que usa el
  // guardado real en studentAttendance.service) — un día puede tener varios
  // maestros distintos dando materias distintas al mismo curso.
  async getWeeklyAttendanceMatrix(courseId: number, dateStr?: string) {
    const activeYear = await reportRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const course = await reportRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    // Semana = lunes..viernes o lunes..sábado según el nivel del curso —
    // mismo criterio que generateSchedule (DAYS): SECUNDARIA sí tiene
    // clases el sábado, el resto no. Anclaje TZ-independiente vía dayRange.
    const numDays = course.level === 'SECUNDARIA' ? 6 : 5
    const DAYS = Array.from({ length: numDays }, (_, i) => i + 1)

    const { base: refDate } = dayRange(dateStr)
    const refDow = dayOfWeekFromBase(refDate)
    const monday = new Date(refDate)
    monday.setUTCDate(monday.getUTCDate() - (refDow - 1))
    const weekEndExclusive = new Date(monday)
    weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + numDays) // exclusivo

    const weekDates: Date[] = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(monday)
      d.setUTCDate(d.getUTCDate() + i)
      weekDates.push(d)
    }

    const [schedule, realBlocks, assignments, schoolSchedule] = await Promise.all([
      reportRepository.findScheduleForCourseWeek(courseId, activeYear.id, DAYS),
      reportRepository.findAttendanceBlocksForCourseWeek(courseId, monday, weekEndExclusive),
      reportRepository.findAssignmentsForCourse(courseId, activeYear.id),
      reportRepository.findActiveSchoolScheduleForShift(course.shift),
    ])

    const studentIds = assignments.map((a) => a.student.id)
    const [attendances, licenses] = await Promise.all([
      reportRepository.findAttendancesForBlocks(realBlocks.map((b) => b.id)),
      reportRepository.findLicensesOverlappingRange(studentIds, monday, weekEndExclusive),
    ])

    type ExpectedBlock = AttendanceBlockRange & {
      dayOfWeek: number; teacherId: number; teacherName: string; subjectName: string | null
    }
    const byDayTeacher = new Map<string, {
      dayOfWeek: number; teacherId: number; teacherName: string
      periods: { period: number; startTime: string; endTime: string; subjectId: number; subjectName: string }[]
    }>()
    for (const s of schedule) {
      const key = `${s.dayOfWeek}-${s.teacherSubjectCourse.teacherId}`
      if (!byDayTeacher.has(key)) {
        byDayTeacher.set(key, {
          dayOfWeek: s.dayOfWeek, teacherId: s.teacherSubjectCourse.teacherId,
          teacherName: `${s.teacherSubjectCourse.teacher.firstName} ${s.teacherSubjectCourse.teacher.lastName}`,
          periods: [],
        })
      }
      byDayTeacher.get(key)!.periods.push({
        period: s.period, startTime: s.startTime, endTime: s.endTime,
        subjectId: s.teacherSubjectCourse.subjectId, subjectName: s.teacherSubjectCourse.subject.name,
      })
    }

    const expectedBlocks: ExpectedBlock[] = []
    for (const group of byDayTeacher.values()) {
      for (const r of groupIntoBlocks(group.periods)) {
        const subjectName = group.periods.find((p) => p.subjectId === r.subjectId)?.subjectName ?? null
        expectedBlocks.push({ ...r, dayOfWeek: group.dayOfWeek, teacherId: group.teacherId, teacherName: group.teacherName, subjectName })
      }
    }

    // Bloques REALES: lookup por (fecha exacta, periodStart) — misma clave
    // natural que @@unique([courseId, date, periodStart]) de AttendanceBlock.
    const realBlockByKey = new Map<string, (typeof realBlocks)[number]>()
    for (const b of realBlocks) realBlockByKey.set(`${b.date.getTime()}-${b.periodStart}`, b)

    const attendanceByBlock = new Map<number, Map<number, string>>()
    for (const a of attendances) {
      if (!attendanceByBlock.has(a.blockId!)) attendanceByBlock.set(a.blockId!, new Map())
      attendanceByBlock.get(a.blockId!)!.set(a.studentId, a.status)
    }

    // Licencias por estudiante (Opción A: nunca se guardan en
    // StudentAttendance — se evalúan acá, por día exacto, al armar cada
    // celda, "tapando" la vista sin tocar el dato real de abajo).
    const licensesByStudent = new Map<number, { startDate: Date; endDate: Date }[]>()
    for (const lic of licenses) {
      if (!licensesByStudent.has(lic.studentId)) licensesByStudent.set(lic.studentId, [])
      licensesByStudent.get(lic.studentId)!.push({ startDate: lic.startDate, endDate: lic.endDate })
    }
    const isOnLicense = (studentId: number, date: Date) =>
      (licensesByStudent.get(studentId) ?? []).some((r) => date.getTime() >= r.startDate.getTime() && date.getTime() <= r.endDate.getTime())

    const roster = assignments.map((a) => a.student)

    const days = weekDates.map((date, idx) => {
      const dow = idx + 1
      const blocksForDay = expectedBlocks
        .filter((b) => b.dayOfWeek === dow)
        .sort((a, b) => a.periodStart - b.periodStart)

      return {
        dayOfWeek: dow,
        date: date.toISOString().split('T')[0],
        blocks: blocksForDay.map((eb) => {
          const realBlock = realBlockByKey.get(`${date.getTime()}-${eb.periodStart}`)
          const attByStudent = realBlock ? attendanceByBlock.get(realBlock.id) : undefined

          let presentes = 0, ausentes = 0, retrasos = 0, licencias = 0, sinRegistrar = 0
          const students = roster.map((st) => {
            const onLicense = isOnLicense(st.id, date)
            const status = onLicense ? 'LICENCIA' : attByStudent?.get(st.id) ?? null
            if (status === 'PRESENTE') presentes++
            else if (status === 'AUSENTE') ausentes++
            else if (status === 'RETRASO') retrasos++
            else if (status === 'LICENCIA') licencias++
            else sinRegistrar++
            return { studentId: st.id, firstName: st.firstName, lastName: st.lastName, status, onLicense }
          })

          return {
            periodStart: eb.periodStart, periodEnd: eb.periodEnd,
            startTime: eb.startTime, endTime: eb.endTime,
            teacherId: eb.teacherId, teacherName: eb.teacherName,
            subjectId: eb.subjectId, subjectName: eb.subjectName,
            registrado: !!realBlock,
            students,
            summary: { presentes, ausentes, retrasos, licencias, sinRegistrar },
          }
        }),
      }
    })

    return {
      course,
      weekStart: days[0].date,
      weekEnd: days[days.length - 1].date,
      maxPeriods: schoolSchedule?.periods ?? 7,
      days,
    }
  },

  async getTreasuryReport(academicYearId?: number, pagination?: Pagination) {
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

    const morosos = await reportRepository.findMorosos(activeYear.id, pagination)
    const morososMapped = morosos.map((p) => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone,
      student: p.students[0]?.student,
      pending: p.charges.reduce((s, c) => s + chargeBalance(c), 0),
      charges: p.charges.length,
    }))

    return {
      academicYear: activeYear,
      summary: { totalCharged, totalCollected, totalPending },
      byType,
      byStatus,
      morosos: await withTotal(morososMapped, pagination, () => reportRepository.countMorosos(activeYear.id)),
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

  // Reporte diario de llegadas tarde — agrupado por curso, con el detalle
  // de cada registro para no necesitar una segunda llamada por curso (el
  // volumen real de un solo colegio no lo justifica).
  async getDailyLateArrivals(dateStr?: string) {
    const { base } = dayRange(dateStr)
    const rows = await reportRepository.findLateArrivalsForDate(base)

    const byCourse = new Map<number, { course: any; records: typeof rows }>()
    for (const r of rows) {
      if (!byCourse.has(r.courseId)) byCourse.set(r.courseId, { course: r.course, records: [] })
      byCourse.get(r.courseId)!.records.push(r)
    }

    const courses = Array.from(byCourse.values()).map(({ course, records }) => ({
      course,
      total: records.length,
      entraronClase: records.filter((r) => r.enteredClass).length,
      noEntraronClase: records.filter((r) => !r.enteredClass).length,
      promedioMinutos: Math.round(records.reduce((s, r) => s + r.minutesLate, 0) / records.length),
      records: records.map((r) => ({
        id: r.id, studentId: r.studentId, firstName: r.student.firstName, lastName: r.student.lastName,
        arrivalTime: r.arrivalTime, minutesLate: r.minutesLate, enteredClass: r.enteredClass, notified: !!r.notifiedAt,
      })),
    }))

    return { date: base.toISOString().split('T')[0], totalDia: rows.length, courses }
  },

  // Reporte semanal de llegadas tarde de UN curso, cruzado contra la
  // asistencia real de esos mismos días (confirmado con Raul: por ahora solo
  // esto, el cruce con notas queda para cuando Calificaciones esté
  // conectado en el panel Admin). Mismo cálculo de semana Lunes-Sábado/
  // Lunes-Viernes que ya usa la matriz semanal de asistencia.
  async getWeeklyLateArrivals(courseId: number, dateStr?: string) {
    const activeYear = await reportRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const course = await reportRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const numDays = course.level === 'SECUNDARIA' ? 6 : 5
    const { base: refDate } = dayRange(dateStr)
    const refDow = dayOfWeekFromBase(refDate)
    const monday = new Date(refDate)
    monday.setUTCDate(monday.getUTCDate() - (refDow - 1))
    const weekEndExclusive = new Date(monday)
    weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + numDays)

    const [lateArrivals, attendances] = await Promise.all([
      reportRepository.findLateArrivalsForCourseWeek(courseId, monday, weekEndExclusive),
      reportRepository.findAttendancesForCourseDateWithTeacher(courseId, activeYear.id, monday, weekEndExclusive),
    ])

    const attendanceByStudent = new Map<number, { date: Date; status: any }[]>()
    for (const a of attendances) {
      if (!attendanceByStudent.has(a.studentId)) attendanceByStudent.set(a.studentId, [])
      attendanceByStudent.get(a.studentId)!.push({ date: a.date, status: a.status })
    }

    const rows = lateArrivals.map((la) => {
      const dailyStatus = collapseToDailyStatus(attendanceByStudent.get(la.studentId) || [])
      const dateKey = la.date.toISOString().split('T')[0]
      return {
        id: la.id, studentId: la.studentId, firstName: la.student.firstName, lastName: la.student.lastName,
        date: dateKey, arrivalTime: la.arrivalTime, minutesLate: la.minutesLate, enteredClass: la.enteredClass,
        notified: !!la.notifiedAt,
        // Estado real de asistencia ESE mismo día, si el maestro ya lo registró.
        realAttendanceStatus: dailyStatus.get(dateKey) ?? null,
      }
    })

    return {
      course: { id: course.id, grade: course.grade, parallel: course.parallel, level: course.level },
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: new Date(weekEndExclusive.getTime() - 86400000).toISOString().split('T')[0],
      total: rows.length,
      rows,
    }
  },

  // Estudiantes ausentes de la semana (Dirección) — TODO el colegio a la
  // vez (a diferencia de getWeeklyLateArrivals, que es de un curso). 2
  // conteos por estudiante: faltas de la semana y faltas del trimestre
  // vigente (determinado por fecha, ver findCurrentTrimester). Semana
  // Lunes-Sábado fija (6 días) como ventana de consulta, unión de los dos
  // largos de semana posibles (Primaria 5, Secundaria 6) — un curso de
  // Primaria simplemente no tiene filas los sábados (sin horario ese día),
  // así que no hay riesgo de sobre-contar.
  //
  // Consultas totales, sin importar cuántos estudiantes/cursos haya: 1)
  // toda la asistencia del TRIMESTRE completo, 2) el roster completo
  // (studentId→courseId), 3) todos los cursos, 4) licencias que se
  // superponen con el trimestre — y una 5ta acotada SOLO a los estudiantes
  // que ya quedaron filtrados por tener falta esta semana (nombre + tutor).
  // Nunca una consulta por estudiante.
  async getWeeklyAbsences(dateStr?: string) {
    const activeYear = await reportRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const { base: refDate } = dayRange(dateStr)
    const refDow = dayOfWeekFromBase(refDate)
    const monday = new Date(refDate)
    monday.setUTCDate(monday.getUTCDate() - (refDow - 1))
    const weekEnd = new Date(monday)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 5) // sábado (Lunes+5)

    const trimester = await reportRepository.findCurrentTrimester(activeYear.id, refDate)
    if (!trimester) throw new HttpError(404, 'No hay trimestre vigente para la fecha de hoy')

    const [attendances, assignments, courses, licenses] = await Promise.all([
      reportRepository.findAttendancesForSchoolRange(activeYear.id, trimester.startDate, trimester.endDate),
      reportRepository.findAllAssignmentsForSchool(activeYear.id),
      reportRepository.findAllCoursesForSchool(),
      reportRepository.findSchoolLicensesOverlappingRange(trimester.startDate, trimester.endDate),
    ])

    const licensesByStudent = new Map<number, { startDate: Date; endDate: Date }[]>()
    for (const lic of licenses) {
      if (!licensesByStudent.has(lic.studentId)) licensesByStudent.set(lic.studentId, [])
      licensesByStudent.get(lic.studentId)!.push({ startDate: lic.startDate, endDate: lic.endDate })
    }
    const isLicensed = (studentId: number, date: Date) =>
      (licensesByStudent.get(studentId) || []).some((l) => date >= l.startDate && date <= l.endDate)

    const byStudent = new Map<number, { date: Date; status: string }[]>()
    for (const a of attendances) {
      if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, [])
      byStudent.get(a.studentId)!.push({ date: a.date, status: a.status })
    }

    const courseByStudent = new Map(assignments.map((a) => [a.studentId, a.courseId]))
    const weekStartKey = monday.toISOString().split('T')[0]
    const weekEndKey = weekEnd.toISOString().split('T')[0]

    const candidates: { studentId: number; courseId: number; faltasSemana: number; faltasTrimestre: number }[] = []
    for (const [studentId, rows] of byStudent) {
      const daily = collapseToDailyStatus(rows as any)
      let faltasSemana = 0
      let faltasTrimestre = 0
      for (const [dateKey, status] of daily) {
        if (status !== 'AUSENTE') continue
        if (isLicensed(studentId, new Date(`${dateKey}T00:00:00.000Z`))) continue
        faltasTrimestre++
        if (dateKey >= weekStartKey && dateKey <= weekEndKey) faltasSemana++
      }
      if (faltasSemana === 0) continue
      const courseId = courseByStudent.get(studentId)
      if (courseId === undefined) continue
      candidates.push({ studentId, courseId, faltasSemana, faltasTrimestre })
    }

    if (candidates.length === 0) {
      return { weekStart: weekStartKey, weekEnd: weekEndKey, trimester, total: 0, students: [] }
    }

    const details = await reportRepository.findStudentDetailsWithTutor(candidates.map((c) => c.studentId))
    const detailById = new Map(details.map((d) => [d.id, d]))
    const courseById = new Map(courses.map((c) => [c.id, c]))
    // `courses` ya viene ordenado pedagógicamente por Postgres (el enum
    // Grade se declara PRIMERO..SEXTO, no alfabético — orderBy en el
    // repositorio ya lo resuelve bien). Se reusa el ÍNDICE de ese array
    // como clave de orden acá, en vez de comparar el string crudo del
    // enum (que ordenaría mal: "QUINTO" antes que "SEGUNDO").
    const courseOrder = new Map(courses.map((c, i) => [c.id, i]))

    const students = candidates
      .map((c) => {
        const d = detailById.get(c.studentId)
        const course = courseById.get(c.courseId)
        const tutorLink = d?.parents[0]
        return {
          studentId: c.studentId,
          firstName: d?.firstName ?? '',
          lastName: d?.lastName ?? '',
          course: course ? { id: course.id, grade: course.grade, parallel: course.parallel, level: course.level } : null,
          faltasSemana: c.faltasSemana,
          faltasTrimestre: c.faltasTrimestre,
          parentId: tutorLink?.parentId ?? null,
          tutorName: tutorLink ? `${tutorLink.parent.lastName} ${tutorLink.parent.firstName}` : null,
          tutorPhone: tutorLink?.parent.phone ?? null,
        }
      })
      .sort((a, b) => {
        const orderA = courseOrder.get(a.course?.id ?? -1) ?? 999
        const orderB = courseOrder.get(b.course?.id ?? -1) ?? 999
        return orderA - orderB || a.lastName.localeCompare(b.lastName)
      })

    return { weekStart: weekStartKey, weekEnd: weekEndKey, trimester, total: students.length, students }
  },
}

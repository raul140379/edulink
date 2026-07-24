import { scheduleRepository } from '../repositories/schedule.repository'
import { HttpError } from '../utils/http-error'
import { CreateSchoolScheduleInput, UpdateSchoolScheduleInput, AssignPeriodInput } from '../schemas/schedule.schema'
import { getTenantContext } from '../lib/tenant-context'

const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function calcularPeriodos(startTime: string, periods: number, periodDuration: number, breakDuration: number, breakAfter: string) {
  const breakPeriods = breakAfter.split(',').map(Number)
  const [startHour, startMin] = startTime.split(':').map(Number)
  let currentMinutes = startHour * 60 + startMin
  const result: { period: number; startTime: string; endTime: string }[] = []

  for (let i = 1; i <= periods; i++) {
    const start = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`
    currentMinutes += periodDuration
    const end = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`
    result.push({ period: i, startTime: start, endTime: end })
    if (breakPeriods.includes(i)) currentMinutes += breakDuration
  }
  return result
}

function groupByDay(schedules: any[]) {
  const byDay: Record<number, any[]> = {}
  schedules.forEach((s) => {
    if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = []
    byDay[s.dayOfWeek].push(s)
  })
  return Object.entries(byDay).map(([day, items]) => ({ day: parseInt(day), dayName: DAY_NAMES[parseInt(day)], periods: items }))
}

export const scheduleService = {
  getSchoolSchedules() {
    return scheduleRepository.findAllSchoolSchedules()
  },

  async createSchoolSchedule(input: CreateSchoolScheduleInput) {
    const hayActivo = await scheduleRepository.findActiveSchoolScheduleForShift(input.shift)

    return scheduleRepository.createSchoolSchedule({
      shift: input.shift, name: input.name, startTime: input.startTime, exitTime: input.exitTime,
      periods: input.periods || 7,
      periodDuration: input.periodDuration || 40,
      breakDuration: input.breakDuration || 15,
      breakAfter: input.breakAfter || '2,4',
      isWinter: input.isWinter || false,
      isActive: !hayActivo,
      school: { connect: { id: getTenantContext()?.schoolId ?? 0 } },
    })
  },

  async updateSchoolSchedule(id: number, input: UpdateSchoolScheduleInput) {
    if (input.isActive === true) {
      const current = await scheduleRepository.findSchoolScheduleById(id)
      if (current) await scheduleRepository.deactivateOthersForShift(current.shift, id)
    }

    return scheduleRepository.updateSchoolSchedule(id, input)
  },

  async getPeriodos(schoolScheduleId: number) {
    const ss = await scheduleRepository.findSchoolScheduleById(schoolScheduleId)
    if (!ss) throw new HttpError(404, 'Configuración no encontrada')

    const periodos = calcularPeriodos(ss.startTime, ss.periods, ss.periodDuration, ss.breakDuration, ss.breakAfter)
    return { schoolSchedule: ss, periodos }
  },

  async getCourseSchedule(courseId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const schedules = await scheduleRepository.findSchedulesByCourse(courseId, activeYear.id)
    const byDay: Record<number, any[]> = {}
    for (let d = 1; d <= 6; d++) byDay[d] = []
    schedules.forEach((s) => byDay[s.dayOfWeek].push(s))

    const result = Object.entries(byDay)
      .filter(([, items]) => items.length > 0)
      .map(([day, items]) => ({ day: parseInt(day), dayName: DAY_NAMES[parseInt(day)], periods: items }))

    return { courseId, academicYearId: activeYear.id, schedule: result }
  },

  async assignPeriod(courseId: number, input: AssignPeriodInput) {
    const activeYear = input.academicYearId
      ? { id: input.academicYearId }
      : await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const tsc = await scheduleRepository.findTeacherSubjectCourse(input.teacherSubjectCourseId, courseId)
    if (!tsc) throw new HttpError(404, 'Asignación de materia no encontrada para este curso')

    const course = await scheduleRepository.findCourseById(courseId)
    const schoolSchedule = await scheduleRepository.findActiveSchoolScheduleForShift(course?.shift || 'MORNING')

    if (schoolSchedule) {
      const gradeConfig = tsc.subject.gradeConfigs.find(
        (gc) => gc.grade === tsc.course.grade && gc.educationType === tsc.course.educationType
      )

      if (gradeConfig) {
        // hoursPerWeek almacena horas académicas del MES (se divide entre 4 semanas).
        // 1 hora académica = 1 periodo (40 min), por eso ya no se convierte a minutos.
        const maxPeriodos = Math.round(gradeConfig.hoursPerWeek / 4)

        const yaAsignados = await scheduleRepository.countAssignedPeriods(courseId, activeYear.id, input.teacherSubjectCourseId)

        if (yaAsignados >= maxPeriodos) {
          throw new HttpError(400, `${tsc.subject.name} ya tiene el máximo de periodos asignados (${maxPeriodos} periodos/semana según su carga horaria)`)
        }
      }
    }

    const conflictoMaestro = await scheduleRepository.findTeacherConflict(activeYear.id, input.dayOfWeek, input.period, tsc.teacherId)
    if (conflictoMaestro) {
      throw new HttpError(400, `El maestro ya tiene clase asignada el ${DAY_NAMES[input.dayOfWeek]} en el periodo ${input.period}`)
    }

    return scheduleRepository.upsertPeriod(courseId, activeYear.id, input.dayOfWeek, input.period, {
      startTime: input.startTime, endTime: input.endTime, teacherSubjectCourseId: input.teacherSubjectCourseId,
    })
  },

  async deletePeriod(id: number) {
    await scheduleRepository.deletePeriod(id)
  },

  async getTeacherSchedule(teacherId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const schedules = await scheduleRepository.findSchedulesByTeacher(activeYear.id, teacherId)
    return { teacherId, schedule: groupByDay(schedules) }
  },

  async getMySchedule(userId: number | undefined) {
    const teacher = await scheduleRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Perfil no encontrado')

    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) return []

    const schedules = await scheduleRepository.findSchedulesByTeacher(activeYear.id, teacher.id)
    return groupByDay(schedules)
  },

  async generateSchedule(courseId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const course = await scheduleRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const schoolSchedule = await scheduleRepository.findActiveSchoolScheduleForShift(course.shift)
    if (!schoolSchedule) throw new HttpError(400, 'No hay horario institucional activo para este turno')

    const periodDuration = schoolSchedule.periodDuration
    const totalPeriods   = schoolSchedule.periods
    const DAYS = course.level === 'SECUNDARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]

    const tscs = await scheduleRepository.findTeacherSubjectCoursesForCourse(courseId, course.grade, course.educationType)
    if (tscs.length === 0) throw new HttpError(400, 'El curso no tiene materias asignadas')

    // hoursPerWeek almacena horas académicas del MES (se divide entre 4 semanas).
    // 1 hora académica = 1 periodo (40 min), por eso ya no se convierte a minutos.
    const materias = tscs
      .map((tsc) => {
        const periodosSemanales = Math.round((tsc.subject.gradeConfigs[0]?.hoursPerWeek || 0) / 4)
        return { tscId: tsc.id, teacherId: tsc.teacherId, subject: tsc.subject.name, pendientes: periodosSemanales, total: periodosSemanales }
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)

    await scheduleRepository.deleteDraftForCourse(courseId, activeYear.id)

    const periodTimes = calcularPeriodos(schoolSchedule.startTime, totalPeriods, periodDuration, schoolSchedule.breakDuration, schoolSchedule.breakAfter)

    const existingSchedules = await scheduleRepository.findPublishedSchedules(activeYear.id)
    const maestroOcupado: Record<number, Set<string>> = {}
    existingSchedules.forEach((s) => {
      const tid = s.teacherSubjectCourse.teacherId
      if (!maestroOcupado[tid]) maestroOcupado[tid] = new Set()
      maestroOcupado[tid].add(`${s.dayOfWeek}-${s.period}`)
    })

    const cursoOcupado = new Set<string>()
    const created: any[] = []
    const errors: any[] = []

    let hayPendientes = true
    while (hayPendientes) {
      hayPendientes = false

      for (const materia of materias) {
        if (materia.pendientes <= 0) continue
        hayPendientes = true

        const asignadosPorDia: Record<number, number> = {}
        DAYS.forEach((d) => (asignadosPorDia[d] = 0))
        created.filter((c) => c.teacherSubjectCourseId === materia.tscId).forEach((c) => asignadosPorDia[c.dayOfWeek]++)

        const diasOrdenados = [...DAYS].sort((a, b) => asignadosPorDia[a] - asignadosPorDia[b])

        let asignado = false
        for (const day of diasOrdenados) {
          if (asignado) break

          for (let p = 1; p <= totalPeriods; p++) {
            const key = `${day}-${p}`
            if (cursoOcupado.has(key)) continue

            if (!maestroOcupado[materia.teacherId]) maestroOcupado[materia.teacherId] = new Set()
            if (maestroOcupado[materia.teacherId].has(key)) continue

            const pt = periodTimes[p - 1]
            created.push({
              courseId, academicYearId: activeYear.id, dayOfWeek: day, period: p,
              startTime: pt.startTime, endTime: pt.endTime,
              teacherSubjectCourseId: materia.tscId, status: 'BORRADOR',
            })
            cursoOcupado.add(key)
            maestroOcupado[materia.teacherId].add(key)
            materia.pendientes--
            asignado = true
            break
          }
        }

        if (!asignado) {
          errors.push({ subject: materia.subject, periodosFaltantes: materia.pendientes })
          materia.pendientes = 0
        }
      }
    }

    await scheduleRepository.createManySchedules(created)

    return { created: created.length, errors, courseId }
  },

  async publishSchedule(courseId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const updated = await scheduleRepository.publishDraftForCourse(courseId, activeYear.id)
    return updated.count
  },

  async deleteDraft(courseId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const deleted = await scheduleRepository.deleteDraftForCourse(courseId, activeYear.id)
    return deleted.count
  },

  async deleteAllSchedule(courseId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const deleted = await scheduleRepository.deleteAllForCourse(courseId, activeYear.id)
    return deleted.count
  },

  async getTscsByCourse(courseId: number) {
    const course = await scheduleRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const schoolSchedule = await scheduleRepository.findActiveSchoolScheduleForShift(course.shift)
    const tscs = await scheduleRepository.findTeacherSubjectCoursesWithGradeConfig(courseId, course.grade, course.educationType)

    // hoursPerWeek almacena horas académicas del MES (se divide entre 4 semanas).
    // 1 hora académica = 1 periodo (40 min), por eso ya no se convierte a minutos.
    return tscs.map((t) => {
      const hoursPerMonth = t.subject.gradeConfigs[0]?.hoursPerWeek || 0
      const maxPeriodos   = Math.round(hoursPerMonth / 4)
      return {
        id: t.id, teacherId: t.teacherId, subjectId: t.subjectId, teacher: t.teacher,
        subject: { id: t.subject.id, name: t.subject.name, campo: t.subject.campo },
        hoursPerMonth, maxPeriodos,
      }
    })
  },

  async getPeriodsSummary(courseId: number) {
    const activeYear = await scheduleRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const schedules = await scheduleRepository.findPublishedSchedulesForCourse(courseId, activeYear.id)

    const summary: Record<number, number> = {}
    schedules.forEach((s) => {
      const sid = s.teacherSubjectCourse.subjectId
      summary[sid] = (summary[sid] || 0) + 1
    })

    return { courseId, summary }
  },
}

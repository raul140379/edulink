import { planificacionRepository } from '../repositories/planificacion.repository'
import { HttpError } from '../utils/http-error'
import {
  GeneratePlanificacionInput, SaveSlotInput, AssignPlanPeriodInput, PromotePlanificacionInput,
} from '../schemas/planificacion.schema'

function calcularPeriodos(startTime: string, periods: number, periodDuration: number, breakDuration: number, breakAfter: string) {
  const breakPeriods = breakAfter.split(',').map(Number)
  const [h, m] = startTime.split(':').map(Number)
  let cur = h * 60 + m
  const result: { period: number; startTime: string; endTime: string }[] = []
  for (let i = 1; i <= periods; i++) {
    const start = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
    cur += periodDuration
    const end = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
    result.push({ period: i, startTime: start, endTime: end })
    if (breakPeriods.includes(i)) cur += breakDuration
  }
  return result
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function intentarAsignarBloque(
  materia: any, bloque: number, maxPorDia: number, maxPeriodo: number, DAYS: number[],
  cursoOcupado: Set<string>, maestroOcupado: Record<number, Set<string>>, created: any[],
  course: any, activeYearId: number, periodTimes: any[]
): boolean {
  const asignadosPorDia: Record<number, number> = {}
  DAYS.forEach((d) => (asignadosPorDia[d] = 0))
  created
    .filter((c) => c.teacherSubjectCourseId === materia.tscId && c.courseId === course.id)
    .forEach((c) => asignadosPorDia[c.dayOfWeek]++)

  const diasOrdenados = shuffle(DAYS).sort((a, b) => asignadosPorDia[a] - asignadosPorDia[b])

  for (const day of diasOrdenados) {
    if (asignadosPorDia[day] + bloque > maxPorDia) continue

    const periodosOrden = shuffle(
      Array.from({ length: Math.min(maxPeriodo, periodTimes.length) - bloque + 1 }, (_, i) => i + 1)
    )

    for (const p of periodosOrden) {
      let bloqueLibre = true

      for (let b = 0; b < bloque; b++) {
        const key = `${day}-${p + b}`
        if (cursoOcupado.has(key)) { bloqueLibre = false; break }
        if (!maestroOcupado[materia.teacherId]) maestroOcupado[materia.teacherId] = new Set()
        if (maestroOcupado[materia.teacherId].has(key)) { bloqueLibre = false; break }

        const periodoActual = p + b
        const vecesEnEstePeriodo = created.filter((c) =>
          c.teacherSubjectCourseId === materia.tscId && c.courseId === course.id && c.period === periodoActual
        ).length
        if (vecesEnEstePeriodo >= 2) { bloqueLibre = false; break }

        const diasAsignados = created
          .filter((c) => c.teacherSubjectCourseId === materia.tscId && c.courseId === course.id)
          .map((c) => c.dayOfWeek)
        const ultimoDia = diasAsignados.length > 0 ? Math.max(...diasAsignados) : 0
        if (ultimoDia > 0 && Math.abs(day - ultimoDia) === 1) { bloqueLibre = false; break }
      }

      if (bloqueLibre) {
        for (let b = 0; b < bloque; b++) {
          const key = `${day}-${p + b}`
          const pt = periodTimes[p + b - 1]
          created.push({
            courseId: course.id, academicYearId: activeYearId, dayOfWeek: day, period: p + b,
            startTime: pt.startTime, endTime: pt.endTime, teacherSubjectCourseId: materia.tscId, slot: 'TEMP',
          })
          cursoOcupado.add(key)
          maestroOcupado[materia.teacherId].add(key)
        }
        return true
      }
    }
  }
  return false
}

export const planificacionService = {
  async generatePlanificacion(input: GeneratePlanificacionInput) {
    const {
      periodosConsecutivos = 2, maxPorDia = 2, maxPeriodo = 6, porcentajeBase = 80,
    } = input

    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const courses = await planificacionRepository.findAllCourses()
    if (!courses.length) throw new HttpError(400, 'No hay cursos registrados')

    await planificacionRepository.deleteTempPlan(activeYear.id)

    const maestroOcupado: Record<number, Set<string>> = {}
    const created: any[] = []
    const errors: any[] = []

    for (const course of courses) {
      const schoolSchedule = await planificacionRepository.findActiveSchoolScheduleForShift(course.shift)
      if (!schoolSchedule) {
        errors.push({ course: `${course.grade} ${course.parallel}`, msg: 'Sin horario institucional activo' })
        continue
      }

      const DAYS = course.level === 'SECUNDARIA' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
      const periodTimes = calcularPeriodos(
        schoolSchedule.startTime, schoolSchedule.periods, schoolSchedule.periodDuration,
        schoolSchedule.breakDuration, schoolSchedule.breakAfter
      )

      const tscs = await planificacionRepository.findTeacherSubjectCoursesForCourse(course.id, course.grade, course.educationType)
      if (!tscs.length) continue

      // hoursPerWeek almacena horas académicas del MES (se divide entre 4 semanas).
      // 1 hora académica = 1 periodo (40 min), por eso ya no se convierte a minutos.
      const materias = shuffle(
        tscs.map((tsc) => {
          const hoursPerMonth = tsc.subject.gradeConfigs[0]?.hoursPerWeek || 0
          const periodosSemanales = Math.round(hoursPerMonth / 4)
          const periodosFase1 = Math.floor(periodosSemanales * (porcentajeBase / 100))
          return {
            tscId: tsc.id, teacherId: tsc.teacherId, subject: tsc.subject.name,
            total: periodosSemanales, fase1: periodosFase1, fase2: periodosSemanales - periodosFase1, asignados: 0,
          }
        }).filter((m) => m.total > 0)
      ).sort((a, b) => b.total - a.total)

      const cursoOcupado = new Set<string>()

      // ── FASE 1: asignar porcentaje base de cada materia ──
      for (const materia of materias) {
        let restantes = materia.fase1

        while (restantes > 0) {
          const bloque = Math.min(periodosConsecutivos, restantes)
          const ok = intentarAsignarBloque(materia, bloque, maxPorDia, maxPeriodo, DAYS, cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes)
          if (ok) {
            materia.asignados += bloque
            restantes -= bloque
          } else if (bloque > 1) {
            const ok1 = intentarAsignarBloque(materia, 1, maxPorDia, maxPeriodo, DAYS, cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes)
            if (ok1) { materia.asignados += 1; restantes -= 1 } else break
          } else break
        }
      }

      // ── FASE 2: asignar resto priorizando los que tienen más periodos pendientes ──
      const materiasConPendientes = materias
        .filter((m) => m.asignados < m.total)
        .sort((a, b) => (b.total - b.asignados) - (a.total - a.asignados))

      for (const materia of materiasConPendientes) {
        let restantes = materia.total - materia.asignados

        while (restantes > 0) {
          const bloque = Math.min(periodosConsecutivos, restantes)
          const ok = intentarAsignarBloque(materia, bloque, maxPorDia, maxPeriodo, DAYS, cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes)
          if (ok) {
            materia.asignados += bloque
            restantes -= bloque
          } else if (bloque > 1) {
            const ok1 = intentarAsignarBloque(materia, 1, maxPorDia, maxPeriodo, DAYS, cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes)
            if (ok1) { materia.asignados += 1; restantes -= 1 } else break
          } else break
        }

        if (materia.asignados < materia.total) {
          errors.push({ course: `${course.grade} ${course.parallel}`, subject: materia.subject, msg: `${materia.asignados}/${materia.total} periodos asignados` })
        }
      }
    }

    await planificacionRepository.createManyPlans(created)

    return { message: `Planificación generada: ${created.length} periodos`, created: created.length, errors }
  },

  async saveSlot(input: SaveSlotInput) {
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const temp = await planificacionRepository.findPlansBySlot(activeYear.id, 'TEMP')
    if (!temp.length) throw new HttpError(400, 'No hay planificación temporal para guardar')

    await planificacionRepository.deletePlansBySlot(activeYear.id, input.slot)

    const data = temp.map((p) => ({
      courseId: p.courseId, academicYearId: p.academicYearId, dayOfWeek: p.dayOfWeek, period: p.period,
      startTime: p.startTime, endTime: p.endTime, teacherSubjectCourseId: p.teacherSubjectCourseId,
      classroomId: p.classroomId, slot: input.slot,
    }))

    await planificacionRepository.createManyPlans(data)
    return { message: `Planificación guardada en Slot ${input.slot}: ${data.length} periodos` }
  },

  async getPlanificacionByCourse(courseId: number, slot: string) {
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const plans = await planificacionRepository.findPlansByCourseAndSlot(courseId, activeYear.id, slot)
    return { courseId, slot, plans }
  },

  async getPlanificacionTeachers(slot: string) {
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const plans = await planificacionRepository.findPlansForTeachersView(activeYear.id, slot)
    return { slot, plans }
  },

  async getSlotsStatus() {
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const [temp, slotA, slotB] = await Promise.all([
      planificacionRepository.countBySlot(activeYear.id, 'TEMP'),
      planificacionRepository.countBySlot(activeYear.id, 'A'),
      planificacionRepository.countBySlot(activeYear.id, 'B'),
    ])

    return { TEMP: temp, A: slotA, B: slotB }
  },

  async assignPlanPeriod(courseId: number, input: AssignPlanPeriodInput) {
    const slot = input.slot || 'TEMP'
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const tsc = await planificacionRepository.findTeacherSubjectCourseById(input.teacherSubjectCourseId)
    if (!tsc) throw new HttpError(404, 'Asignación no encontrada')

    const conflicto = await planificacionRepository.findPlanConflict(activeYear.id, input.dayOfWeek, input.period, slot, tsc.teacherId)
    if (conflicto) throw new HttpError(400, 'El maestro ya tiene clase en ese periodo')

    return planificacionRepository.upsertPlanPeriod(courseId, activeYear.id, input.dayOfWeek, input.period, slot, {
      startTime: input.startTime, endTime: input.endTime, teacherSubjectCourseId: input.teacherSubjectCourseId,
    })
  },

  async deletePlanPeriod(id: number) {
    await planificacionRepository.deletePlanPeriod(id)
  },

  async clearSlot(slot: string) {
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const deleted = await planificacionRepository.deletePlansBySlot(activeYear.id, slot)
    return deleted.count
  },

  async promotePlanificacion(input: PromotePlanificacionInput) {
    const slot = input.slot || 'TEMP'
    const activeYear = await planificacionRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const plans = await planificacionRepository.findPlansBySlot(activeYear.id, slot)
    if (!plans.length) throw new HttpError(400, `No hay planificación en Slot ${slot}`)

    await planificacionRepository.deleteDraftSchedules(activeYear.id)

    const data = plans.map((p) => ({
      courseId: p.courseId, academicYearId: p.academicYearId, dayOfWeek: p.dayOfWeek, period: p.period,
      startTime: p.startTime, endTime: p.endTime, teacherSubjectCourseId: p.teacherSubjectCourseId,
      classroomId: p.classroomId, status: 'BORRADOR',
    }))

    await planificacionRepository.createManySchedules(data)
    return { message: `Slot ${slot} promovido al horario oficial: ${data.length} periodos` }
  },
}

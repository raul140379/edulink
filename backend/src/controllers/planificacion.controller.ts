import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

const calcularPeriodos = (startTime: string, periods: number, periodDuration: number, breakDuration: number, breakAfter: string) => {
  const breakPeriods = breakAfter.split(',').map(Number)
  const [h, m] = startTime.split(':').map(Number)
  let cur = h * 60 + m
  const result: { period: number; startTime: string; endTime: string }[] = []
  for (let i = 1; i <= periods; i++) {
    const start = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
    cur += periodDuration
    const end = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
    result.push({ period: i, startTime: start, endTime: end })
    if (breakPeriods.includes(i)) cur += breakDuration
  }
  return result
}

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const intentarAsignarBloque = (
  materia: any,
  bloque: number,
  maxPorDia: number,
  maxPeriodo: number,
  DAYS: number[],
  cursoOcupado: Set<string>,
  maestroOcupado: Record<number, Set<string>>,
  created: any[],
  course: any,
  activeYearId: number,
  periodTimes: any[]
): boolean => {
  const asignadosPorDia: Record<number, number> = {}
  DAYS.forEach(d => asignadosPorDia[d] = 0)
  created
    .filter(c => c.teacherSubjectCourseId === materia.tscId && c.courseId === course.id)
    .forEach(c => asignadosPorDia[c.dayOfWeek]++)

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
        const vecesEnEstePeriodo = created.filter(c =>
          c.teacherSubjectCourseId === materia.tscId &&
          c.courseId === course.id &&
          c.period === periodoActual
        ).length
        if (vecesEnEstePeriodo >= 2) { bloqueLibre = false; break }

        const diasAsignados = created
          .filter(c => c.teacherSubjectCourseId === materia.tscId && c.courseId === course.id)
          .map(c => c.dayOfWeek)
        const ultimoDia = diasAsignados.length > 0 ? Math.max(...diasAsignados) : 0
        if (ultimoDia > 0 && Math.abs(day - ultimoDia) === 1) { bloqueLibre = false; break }
      }

      if (bloqueLibre) {
        for (let b = 0; b < bloque; b++) {
          const key = `${day}-${p + b}`
          const pt  = periodTimes[p + b - 1]
          created.push({
            courseId:               course.id,
            academicYearId:         activeYearId,
            dayOfWeek:              day,
            period:                 p + b,
            startTime:              pt.startTime,
            endTime:                pt.endTime,
            teacherSubjectCourseId: materia.tscId,
            slot:                   'TEMP',
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

// ─────────────────────────────────────────────
// POST /api/planificacion/generate
// ─────────────────────────────────────────────
export const generatePlanificacion = async (req: AuthRequest, res: Response): Promise<void> => {
    
  try {
    const {
      periodosConsecutivos = 2,
      maxPorDia            = 2,
      maxPeriodo           = 6,
      porcentajeBase       = 80,
    } = req.body 
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const courses = await prisma.course.findMany()
    if (!courses.length) { res.status(400).json({ message: 'No hay cursos registrados' }); return }

    await prisma.schedulePlan.deleteMany({
      where: { academicYearId: activeYear.id, slot: 'TEMP' }
    })

    const maestroOcupado: Record<number, Set<string>> = {}
    const created: any[] = []
    const errors:  any[] = []

    for (const course of courses) {
      const schoolSchedule = await prisma.schoolSchedule.findFirst({
        where: { isActive: true, shift: course.shift }
      })
      if (!schoolSchedule) {
        errors.push({ course: `${course.grade} ${course.parallel}`, msg: 'Sin horario institucional activo' })
        continue
      }

      const DAYS        = course.level === 'SECUNDARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5]
      const periodTimes = calcularPeriodos(
        schoolSchedule.startTime, schoolSchedule.periods, schoolSchedule.periodDuration,
        schoolSchedule.breakDuration, schoolSchedule.breakAfter
      )

      const tscs = await prisma.teacherSubjectCourse.findMany({
        where: { courseId: course.id },
        include: {
          subject: {
            include: {
              gradeConfigs: {
                where: { grade: course.grade, educationType: course.educationType }
              }
            }
          }
        }
      })

      if (!tscs.length) continue

      // Calcular periodos totales por materia
      const materias = shuffle(tscs.map(tsc => {
        const hoursPerMonth     = tsc.subject.gradeConfigs[0]?.hoursPerWeek || 0
        const minsPerWeek       = (hoursPerMonth / 4) * 60
        const periodosSemanales = Math.floor(minsPerWeek / schoolSchedule.periodDuration)
        const periodosFase1     = Math.floor(periodosSemanales * (porcentajeBase / 100))
        return {
          tscId:        tsc.id,
          teacherId:    tsc.teacherId,
          subject:      tsc.subject.name,
          total:        periodosSemanales,
          fase1:        periodosFase1,
          fase2:        periodosSemanales - periodosFase1,
          asignados:    0,
        }
      }).filter(m => m.total > 0))
        .sort((a, b) => b.total - a.total)

      const cursoOcupado = new Set<string>()

      // ── FASE 1: asignar porcentaje base de cada materia ──
      for (const materia of materias) {
        let restantes = materia.fase1

        while (restantes > 0) {
          const bloque = Math.min(periodosConsecutivos, restantes)
          const ok = intentarAsignarBloque(
            materia, bloque, maxPorDia, maxPeriodo, DAYS,
            cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes
          )
          if (ok) {
            materia.asignados += bloque
            restantes -= bloque
          } else {
            // intentar con bloque de 1 si el bloque completo no cabe
            if (bloque > 1) {
              const ok1 = intentarAsignarBloque(
                materia, 1, maxPorDia, maxPeriodo, DAYS,
                cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes
              )
              if (ok1) { materia.asignados += 1; restantes -= 1 }
              else break
            } else break
          }
        }
      }

      // ── FASE 2: asignar resto priorizando los que tienen más periodos pendientes ──
      const materiasConPendientes = materias
        .filter(m => m.asignados < m.total)
        .sort((a, b) => (b.total - b.asignados) - (a.total - a.asignados))

      for (const materia of materiasConPendientes) {
        let restantes = materia.total - materia.asignados

        while (restantes > 0) {
          const bloque = Math.min(periodosConsecutivos, restantes)
          const ok = intentarAsignarBloque(
            materia, bloque, maxPorDia, maxPeriodo, DAYS,
            cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes
          )
          if (ok) {
            materia.asignados += bloque
            restantes -= bloque
          } else {
            if (bloque > 1) {
              const ok1 = intentarAsignarBloque(
                materia, 1, maxPorDia, maxPeriodo, DAYS,
                cursoOcupado, maestroOcupado, created, course, activeYear.id, periodTimes
              )
              if (ok1) { materia.asignados += 1; restantes -= 1 }
              else break
            } else break
          }
        }

        if (materia.asignados < materia.total) {
          errors.push({
            course:  `${course.grade} ${course.parallel}`,
            subject: materia.subject,
            msg:     `${materia.asignados}/${materia.total} periodos asignados`,
          })
        }
      }
    }

    await prisma.schedulePlan.createMany({ data: created, skipDuplicates: true })

    res.json({
      message: `Planificación generada: ${created.length} periodos`,
      created: created.length,
      errors,
    })
  } catch (error) {
    console.error('generatePlanificacion error:', error)
    res.status(500).json({ message: 'Error al generar planificación' })
  }
}

// ─────────────────────────────────────────────
// POST /api/planificacion/save-slot
// ─────────────────────────────────────────────
export const saveSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slot } = req.body
    if (!['A','B'].includes(slot)) { res.status(400).json({ message: 'Slot inválido' }); return }

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const temp = await prisma.schedulePlan.findMany({
      where: { academicYearId: activeYear.id, slot: 'TEMP' }
    })
    if (!temp.length) { res.status(400).json({ message: 'No hay planificación temporal para guardar' }); return }

    await prisma.schedulePlan.deleteMany({ where: { academicYearId: activeYear.id, slot } })

    const data = temp.map(p => ({
      courseId:               p.courseId,
      academicYearId:         p.academicYearId,
      dayOfWeek:              p.dayOfWeek,
      period:                 p.period,
      startTime:              p.startTime,
      endTime:                p.endTime,
      teacherSubjectCourseId: p.teacherSubjectCourseId,
      classroomId:            p.classroomId,
      slot,
    }))

    await prisma.schedulePlan.createMany({ data, skipDuplicates: true })
    res.json({ message: `Planificación guardada en Slot ${slot}: ${data.length} periodos` })
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar slot' })
  }
}

// ─────────────────────────────────────────────
// GET /api/planificacion/course/:courseId
// ─────────────────────────────────────────────
export const getPlanificacionByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const slot = (req.query.slot as string) || 'TEMP'

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const plans = await prisma.schedulePlan.findMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id, slot },
      include: {
        classroom: true,
        teacherSubjectCourse: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, campo: true } },
          }
        }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }]
    })

    res.json({ courseId: parseInt(courseId), slot, plans })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener planificación' })
  }
}

// ─────────────────────────────────────────────
// GET /api/planificacion/teachers
// ─────────────────────────────────────────────
export const getPlanificacionTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const slot = (req.query.slot as string) || 'TEMP'
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const plans = await prisma.schedulePlan.findMany({
      where: { academicYearId: activeYear.id, slot },
      include: {
        course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
        teacherSubjectCourse: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, campo: true } },
          }
        }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }]
    })

    res.json({ slot, plans })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener vista de maestros' })
  }
}

// ─────────────────────────────────────────────
// GET /api/planificacion/slots-status
// ─────────────────────────────────────────────
export const getSlotsStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const [temp, slotA, slotB] = await Promise.all([
      prisma.schedulePlan.count({ where: { academicYearId: activeYear.id, slot: 'TEMP' } }),
      prisma.schedulePlan.count({ where: { academicYearId: activeYear.id, slot: 'A'    } }),
      prisma.schedulePlan.count({ where: { academicYearId: activeYear.id, slot: 'B'    } }),
    ])

    res.json({ TEMP: temp, A: slotA, B: slotB })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estado de slots' })
  }
}

// ─────────────────────────────────────────────
// POST /api/planificacion/course/:courseId/period
// ─────────────────────────────────────────────
export const assignPlanPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { dayOfWeek, period, startTime, endTime, teacherSubjectCourseId, slot = 'TEMP' } = req.body

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const tsc = await prisma.teacherSubjectCourse.findUnique({ where: { id: teacherSubjectCourseId } })
    if (!tsc) { res.status(404).json({ message: 'Asignación no encontrada' }); return }

    const conflicto = await prisma.schedulePlan.findFirst({
      where: {
        academicYearId: activeYear.id, dayOfWeek, period, slot,
        teacherSubjectCourse: { teacherId: tsc.teacherId }
      }
    })
    if (conflicto) { res.status(400).json({ message: 'El maestro ya tiene clase en ese periodo' }); return }

    const plan = await prisma.schedulePlan.upsert({
      where: {
        courseId_academicYearId_dayOfWeek_period_slot: {
          courseId: parseInt(courseId), academicYearId: activeYear.id, dayOfWeek, period, slot
        }
      },
      update: { startTime, endTime, teacherSubjectCourseId },
      create: {
        courseId: parseInt(courseId), academicYearId: activeYear.id,
        dayOfWeek, period, startTime, endTime, teacherSubjectCourseId, slot
      },
      include: {
        teacherSubjectCourse: {
          include: {
            teacher: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true, campo: true } },
          }
        }
      }
    })

    res.json({ message: 'Periodo asignado', plan })
  } catch (error) {
    res.status(500).json({ message: 'Error al asignar periodo' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/planificacion/:id
// ─────────────────────────────────────────────
export const deletePlanPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.schedulePlan.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Periodo eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar periodo' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/planificacion/slot/:slot
// ─────────────────────────────────────────────
export const clearSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slot } = req.params
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const deleted = await prisma.schedulePlan.deleteMany({
      where: { academicYearId: activeYear.id, slot }
    })
    res.json({ message: `Slot ${slot} eliminado: ${deleted.count} periodos` })
  } catch (error) {
    res.status(500).json({ message: 'Error al limpiar slot' })
  }
}

// ─────────────────────────────────────────────
// POST /api/planificacion/promote
// ─────────────────────────────────────────────
export const promotePlanificacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slot = 'TEMP' } = req.body

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const plans = await prisma.schedulePlan.findMany({
      where: { academicYearId: activeYear.id, slot }
    })
    if (!plans.length) { res.status(400).json({ message: `No hay planificación en Slot ${slot}` }); return }

    await prisma.schedule.deleteMany({
      where: { academicYearId: activeYear.id, status: 'BORRADOR' }
    })

    const data = plans.map(p => ({
      courseId:               p.courseId,
      academicYearId:         p.academicYearId,
      dayOfWeek:              p.dayOfWeek,
      period:                 p.period,
      startTime:              p.startTime,
      endTime:                p.endTime,
      teacherSubjectCourseId: p.teacherSubjectCourseId,
      classroomId:            p.classroomId,
      status:                 'BORRADOR',
    }))

    await prisma.schedule.createMany({ data, skipDuplicates: true })
    res.json({ message: `Slot ${slot} promovido al horario oficial: ${data.length} periodos` })
  } catch (error) {
    res.status(500).json({ message: 'Error al promover planificación' })
  }
}
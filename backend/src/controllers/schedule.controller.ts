import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ── Helper: calcular horas de cada periodo ──────────────────────
const calcularPeriodos = (startTime: string, periods: number, periodDuration: number, breakDuration: number, breakAfter: string) => {
  const breakPeriods = breakAfter.split(',').map(Number)
  const [startHour, startMin] = startTime.split(':').map(Number)
  let currentMinutes = startHour * 60 + startMin
  const result: { period: number; startTime: string; endTime: string }[] = []

  for (let i = 1; i <= periods; i++) {
    const start = `${String(Math.floor(currentMinutes / 60)).padStart(2,'0')}:${String(currentMinutes % 60).padStart(2,'0')}`
    currentMinutes += periodDuration
    const end = `${String(Math.floor(currentMinutes / 60)).padStart(2,'0')}:${String(currentMinutes % 60).padStart(2,'0')}`
    result.push({ period: i, startTime: start, endTime: end })
    if (breakPeriods.includes(i)) {
      currentMinutes += breakDuration
    }
  }
  return result
}

// ─────────────────────────────────────────────
// GET /api/schedules/school-schedules
// Obtener configuraciones de horario institucional
// ─────────────────────────────────────────────
export const getSchoolSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedules = await prisma.schoolSchedule.findMany({
      orderBy: [{ shift: 'asc' }, { isWinter: 'asc' }]
    })
    res.json(schedules)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener configuraciones' })
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/school-schedules
// Crear configuración de horario institucional
// ─────────────────────────────────────────────
export const createSchoolSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shift, name, startTime, exitTime, periods, periodDuration, breakDuration, breakAfter, isWinter } = req.body

    const schedule = await prisma.schoolSchedule.create({
      data: {
        shift, name, startTime, exitTime,
        periods:        periods        || 7,
        periodDuration: periodDuration || 40,
        breakDuration:  breakDuration  || 15,
        breakAfter:     breakAfter     || '2,4',
        isWinter:       isWinter       || false,
        isActive:       true,
      }
    })

    res.status(201).json({ message: 'Configuración creada correctamente', schedule })
  } catch (error) {
    res.status(500).json({ message: 'Error al crear configuración' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/schedules/school-schedules/:id
// Actualizar configuración
// ─────────────────────────────────────────────
export const updateSchoolSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { shift, name, startTime, exitTime, periods, periodDuration, breakDuration, breakAfter, isWinter, isActive } = req.body

    // Si se está activando, desactivar el otro del mismo turno
    if (isActive === true) {
      const current = await prisma.schoolSchedule.findUnique({ where: { id: parseInt(id) } })
      if (current) {
        await prisma.schoolSchedule.updateMany({
          where: { shift: current.shift, id: { not: parseInt(id) } },
          data:  { isActive: false }
        })
      }
    }

    const schedule = await prisma.schoolSchedule.update({
      where: { id: parseInt(id) },
      data: {
        ...(shift          !== undefined ? { shift }          : {}),
        ...(name           !== undefined ? { name }           : {}),
        ...(startTime      !== undefined ? { startTime }      : {}),
        ...(exitTime       !== undefined ? { exitTime }       : {}),
        ...(periods        !== undefined ? { periods }        : {}),
        ...(periodDuration !== undefined ? { periodDuration } : {}),
        ...(breakDuration  !== undefined ? { breakDuration }  : {}),
        ...(breakAfter     !== undefined ? { breakAfter }     : {}),
        ...(isWinter       !== undefined ? { isWinter }       : {}),
        ...(isActive       !== undefined ? { isActive }       : {}),
      }
    })

    res.json({ message: 'Configuración actualizada', schedule })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar configuración' })
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/periodos/:schoolScheduleId
// Calcular periodos de un horario institucional
// ─────────────────────────────────────────────
export const getPeriodos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolScheduleId } = req.params
    const ss = await prisma.schoolSchedule.findUnique({ where: { id: parseInt(schoolScheduleId) } })
    if (!ss) { res.status(404).json({ message: 'Configuración no encontrada' }); return }

    const periodos = calcularPeriodos(ss.startTime, ss.periods, ss.periodDuration, ss.breakDuration, ss.breakAfter)
    res.json({ schoolSchedule: ss, periodos })
  } catch (error) {
    res.status(500).json({ message: 'Error al calcular periodos' })
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/course/:courseId
// Obtener horario de un curso
// ─────────────────────────────────────────────
export const getCourseSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const schedules = await prisma.schedule.findMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id },
      include: {
        teacherSubjectCourse: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, campo: true } },
          }
        }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }]
    })

    // Agrupar por día
    const byDay: Record<number, any[]> = {}
    for (let d = 1; d <= 6; d++) byDay[d] = []
    schedules.forEach(s => {
      byDay[s.dayOfWeek].push(s)
    })

    const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const result = Object.entries(byDay)
      .filter(([, items]) => items.length > 0)
      .map(([day, items]) => ({
        day: parseInt(day),
        dayName: DAYS[parseInt(day)],
        periods: items
      }))

    res.json({ courseId: parseInt(courseId), academicYearId: activeYear.id, schedule: result })
  } catch (error) {
    console.error('getCourseSchedule error:', error)
    res.status(500).json({ message: 'Error al obtener horario' })
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/course/:courseId/period
// Asignar materia a un periodo del horario
// ─────────────────────────────────────────────
export const assignPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { dayOfWeek, period, startTime, endTime, teacherSubjectCourseId, academicYearId } = req.body

    const activeYear = academicYearId
      ? { id: academicYearId }
      : await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    // Verificar que teacherSubjectCourse existe y pertenece al curso
    const tsc = await prisma.teacherSubjectCourse.findFirst({
      where: { id: teacherSubjectCourseId, courseId: parseInt(courseId) },
      include: {
        subject: {
          include: {
            gradeConfigs: true
          }
        },
        course: { select: { grade: true, educationType: true } }
      }
    })
    if (!tsc) { res.status(404).json({ message: 'Asignación de materia no encontrada para este curso' }); return }

    // Obtener horario institucional activo
    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    const schoolSchedule = await prisma.schoolSchedule.findFirst({
      where: { isActive: true, shift: course?.shift || 'MORNING' }
    })

    if (schoolSchedule) {
      // Calcular periodos máximos permitidos para esta materia
      const gradeConfig = tsc.subject.gradeConfigs.find(
        gc => gc.grade === tsc.course.grade && gc.educationType === tsc.course.educationType
      )

      if (gradeConfig) {
        const hoursPerMonth   = gradeConfig.hoursPerWeek
        const minsPerWeek     = (hoursPerMonth / 4) * 60
        const maxPeriodos     = Math.round(minsPerWeek / schoolSchedule.periodDuration)

        // Contar periodos ya asignados para esta materia en este curso
        const yaAsignados = await prisma.schedule.count({
          where: {
            courseId:      parseInt(courseId),
            academicYearId: activeYear.id,
            teacherSubjectCourseId,
          }
        })

        if (yaAsignados >= maxPeriodos) {
          res.status(400).json({
            message: `${tsc.subject.name} ya tiene el máximo de periodos asignados (${maxPeriodos} periodos/semana según la carga horaria de ${hoursPerMonth} hrs/mes)`
          }); return
        }
      }
    }

    // Verificar conflicto de maestro (mismo día y periodo en otro curso)
    const conflictoMaestro = await prisma.schedule.findFirst({
      where: {
        academicYearId: activeYear.id,
        dayOfWeek,
        period,
        teacherSubjectCourse: { teacherId: tsc.teacherId }
      }
    })
    if (conflictoMaestro) {
      res.status(400).json({
        message: `El maestro ya tiene clase asignada el ${['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][dayOfWeek]} en el periodo ${period}`
      }); return
    }

    const schedule = await prisma.schedule.upsert({
      where: {
        courseId_academicYearId_dayOfWeek_period: {
          courseId:       parseInt(courseId),
          academicYearId: activeYear.id,
          dayOfWeek,
          period,
        }
      },
      update: { startTime, endTime, teacherSubjectCourseId },
      create: {
        courseId:       parseInt(courseId),
        academicYearId: activeYear.id,
        dayOfWeek,
        period,
        startTime,
        endTime,
        teacherSubjectCourseId,
        status: 'BORRADOR',
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

    res.json({ message: 'Periodo asignado correctamente', schedule })
  } catch (error) {
    console.error('assignPeriod error:', error)
    res.status(500).json({ message: 'Error al asignar periodo' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/schedules/:id
// Eliminar un periodo del horario
// ─────────────────────────────────────────────
export const deletePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.schedule.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Periodo eliminado correctamente' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar periodo' })
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/teacher/:teacherId
// Horario del maestro (todas sus materias/cursos)
// ─────────────────────────────────────────────
export const getTeacherSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId } = req.params

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const schedules = await prisma.schedule.findMany({
      where: {
        academicYearId: activeYear.id,
        teacherSubjectCourse: { teacherId: parseInt(teacherId) }
      },
      include: {
        course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
        teacherSubjectCourse: {
          include: {
            subject: { select: { id: true, name: true, campo: true } },
          }
        }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }]
    })

    const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const byDay: Record<number, any[]> = {}
    schedules.forEach(s => {
      if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = []
      byDay[s.dayOfWeek].push(s)
    })

    const result = Object.entries(byDay).map(([day, items]) => ({
      day: parseInt(day),
      dayName: DAYS[parseInt(day)],
      periods: items
    }))

    res.json({ teacherId: parseInt(teacherId), schedule: result })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener horario del maestro' })
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/my-schedule
// Horario del maestro autenticado
// ─────────────────────────────────────────────
export const getMySchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil no encontrado' }); return }

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.json([]); return }

    const schedules = await prisma.schedule.findMany({
      where: {
        academicYearId: activeYear.id,
        teacherSubjectCourse: { teacherId: teacher.id }
      },
      include: {
        course: { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
        teacherSubjectCourse: {
          include: {
            subject: { select: { id: true, name: true, campo: true } },
          }
        }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }]
    })

    const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const byDay: Record<number, any[]> = {}
    schedules.forEach(s => {
      if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = []
      byDay[s.dayOfWeek].push(s)
    })

    const result = Object.entries(byDay).map(([day, items]) => ({
      day: parseInt(day),
      dayName: DAYS[parseInt(day)],
      periods: items
    }))

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener horario' })
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/generate/:courseId
// Generar horario automático (BORRADOR)
// ─────────────────────────────────────────────
export const generateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }

    const schoolSchedule = await prisma.schoolSchedule.findFirst({
      where: { isActive: true, shift: course.shift }
    })
    if (!schoolSchedule) { res.status(400).json({ message: 'No hay horario institucional activo para este turno' }); return }

    const periodDuration = schoolSchedule.periodDuration
    const totalPeriods   = schoolSchedule.periods
    const DAYS = course.level === 'SECUNDARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5]

    // Obtener materias con maestros
    const tscs = await prisma.teacherSubjectCourse.findMany({
      where: { courseId: parseInt(courseId) },
      include: {
        subject: {
          include: {
            gradeConfigs: {
              where: { grade: course.grade, educationType: course.educationType }
            }
          }
        },
      }
    })

    if (tscs.length === 0) {
      res.status(400).json({ message: 'El curso no tiene materias asignadas' }); return
    }

    // Calcular periodos/semana por materia
    const materias = tscs.map(tsc => {
      const hoursPerMonth     = tsc.subject.gradeConfigs[0]?.hoursPerWeek || 0
      const minsPerWeek       = (hoursPerMonth / 4) * 60
      const periodosSemanales = Math.floor(minsPerWeek / periodDuration)
      return {
        tscId:      tsc.id,
        teacherId:  tsc.teacherId,
        subject:    tsc.subject.name,
        pendientes: periodosSemanales,
        total:      periodosSemanales,
      }
    }).filter(m => m.total > 0)
      .sort((a, b) => b.total - a.total) // Ordenar de más a menos periodos

    // Eliminar borrador existente
    await prisma.schedule.deleteMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id, status: 'BORRADOR' }
    })

    // Calcular periodos de horario
    const periodTimes = calcularPeriodos(
      schoolSchedule.startTime,
      totalPeriods,
      periodDuration,
      schoolSchedule.breakDuration,
      schoolSchedule.breakAfter
    )

    // Cargar ocupaciones de maestros en cursos ya publicados
    const existingSchedules = await prisma.schedule.findMany({
      where: { academicYearId: activeYear.id, status: 'PUBLICADO' },
      include: { teacherSubjectCourse: { select: { teacherId: true } } }
    })

    // Mapa de ocupación: teacherId → Set<"día-periodo">
    const maestroOcupado: Record<number, Set<string>> = {}
    existingSchedules.forEach(s => {
      const tid = s.teacherSubjectCourse.teacherId
      if (!maestroOcupado[tid]) maestroOcupado[tid] = new Set()
      maestroOcupado[tid].add(`${s.dayOfWeek}-${s.period}`)
    })

    // Grilla del curso: Set<"día-periodo"> para saber qué celdas están ocupadas
    const cursoOcupado = new Set<string>()
    const created: any[] = []
    const errors:  any[] = []

    // Algoritmo de distribución equitativa
    // Usamos rondas: en cada ronda asignamos 1 periodo de cada materia
    let hayPendientes = true

    while (hayPendientes) {
      hayPendientes = false
      
      for (const materia of materias) {
        if (materia.pendientes <= 0) continue
        hayPendientes = true

        // Calcular cuántos periodos ya asignados por día para esta materia
        const asignadosPorDia: Record<number, number> = {}
        DAYS.forEach(d => asignadosPorDia[d] = 0)
        created.filter(c => c.teacherSubjectCourseId === materia.tscId)
          .forEach(c => asignadosPorDia[c.dayOfWeek]++)

        // Intentar asignar en el día con menos periodos de esta materia
        const diasOrdenados = [...DAYS].sort((a, b) => asignadosPorDia[a] - asignadosPorDia[b])

        let asignado = false
        for (const day of diasOrdenados) {
          if (asignado) break
          
          // Buscar periodo libre en este día
          for (let p = 1; p <= totalPeriods; p++) {
            const key = `${day}-${p}`
            
            // Verificar que el curso no tenga algo en esta celda
            if (cursoOcupado.has(key)) continue

            // Verificar que el maestro no esté ocupado
            if (!maestroOcupado[materia.teacherId]) maestroOcupado[materia.teacherId] = new Set()
            if (maestroOcupado[materia.teacherId].has(key)) continue

            // Asignar
            const pt = periodTimes[p - 1]
            created.push({
              courseId:               parseInt(courseId),
              academicYearId:         activeYear.id,
              dayOfWeek:              day,
              period:                 p,
              startTime:              pt.startTime,
              endTime:                pt.endTime,
              teacherSubjectCourseId: materia.tscId,
              status:                 'BORRADOR',
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
          materia.pendientes = 0 // Evitar loop infinito
        }
      }
    }

    // Guardar en BD
    await prisma.schedule.createMany({ data: created, skipDuplicates: true })

    res.json({
      message:  `Horario generado: ${created.length} periodos asignados`,
      created:  created.length,
      errors,
      courseId: parseInt(courseId),
    })
  } catch (error) {
    console.error('generateSchedule error:', error)
    res.status(500).json({ message: 'Error al generar horario' })
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/publish/:courseId
// Consolidar horario (BORRADOR → PUBLICADO)
// ─────────────────────────────────────────────
export const publishSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const updated = await prisma.schedule.updateMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id, status: 'BORRADOR' },
      data:  { status: 'PUBLICADO' }
    })

    res.json({ message: `Horario publicado: ${updated.count} periodos confirmados`, count: updated.count })
  } catch (error) {
    res.status(500).json({ message: 'Error al publicar horario' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/schedules/draft/:courseId
// Eliminar borrador
// ─────────────────────────────────────────────
export const deleteDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const deleted = await prisma.schedule.deleteMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id, status: 'BORRADOR' }
    })

    res.json({ message: `Borrador eliminado: ${deleted.count} periodos`, count: deleted.count })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar borrador' })
  }
}


export const getTscsByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }

    // Obtener horario activo para calcular periodos máximos
    const schoolSchedule = await prisma.schoolSchedule.findFirst({
      where: { isActive: true, shift: course.shift }
    })

    const tscs = await prisma.teacherSubjectCourse.findMany({
      where: { courseId: parseInt(courseId) },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: {
          select: {
            id: true, name: true, campo: true,
            gradeConfigs: {
              where: { grade: course.grade, educationType: course.educationType }
            }
          }
        },
      }
    })

    // Agregar periodos máximos calculados
    const result = tscs.map(t => {
      const hoursPerMonth    = t.subject.gradeConfigs[0]?.hoursPerWeek || 0
      const minsPerWeek      = (hoursPerMonth / 4) * 60
      const maxPeriodos      = schoolSchedule
        ? Math.floor(minsPerWeek / schoolSchedule.periodDuration)
        : 0
      return {
        id:          t.id,
        teacherId:   t.teacherId,
        subjectId:   t.subjectId,
        teacher:     t.teacher,
        subject:     { id: t.subject.id, name: t.subject.name, campo: t.subject.campo },
        hoursPerMonth,
        maxPeriodos,
      }
    })

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener asignaciones' })
  }
}
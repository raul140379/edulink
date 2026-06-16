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
      where: { id: teacherSubjectCourseId, courseId: parseInt(courseId) }
    })
    if (!tsc) { res.status(404).json({ message: 'Asignación de materia no encontrada para este curso' }); return }

    const schedule = await prisma.schedule.upsert({
      where: {
        courseId_academicYearId_dayOfWeek_period: {
          courseId:      parseInt(courseId),
          academicYearId: activeYear.id,
          dayOfWeek,
          period,
        }
      },
      update: { startTime, endTime, teacherSubjectCourseId },
      create: {
        courseId:      parseInt(courseId),
        academicYearId: activeYear.id,
        dayOfWeek,
        period,
        startTime,
        endTime,
        teacherSubjectCourseId,
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

    // 1. Obtener gestión activa
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    // 2. Obtener curso
    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }

    // 3. Obtener horario institucional activo
    const schoolSchedule = await prisma.schoolSchedule.findFirst({
      where: { isActive: true, shift: course.shift }
    })
    if (!schoolSchedule) { res.status(400).json({ message: 'No hay horario institucional activo para este turno' }); return }

    // 4. Calcular periodos disponibles por día
    const periodDuration = schoolSchedule.periodDuration
    const totalPeriods   = schoolSchedule.periods
    const DAYS = course.level === 'SECUNDARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5]

    // 5. Obtener materias asignadas al curso con sus maestros
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
        teacher: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    if (tscs.length === 0) {
      res.status(400).json({ message: 'El curso no tiene materias asignadas' }); return
    }

    // 6. Calcular periodos/semana por materia
    const materiasConPeriodos = tscs.map(tsc => {
      const hoursPerMonth = tsc.subject.gradeConfigs[0]?.hoursPerWeek || 0
      const minsPerMonth  = hoursPerMonth * 60
      const minsPerWeek   = minsPerMonth / 4
      const periodosSemanales = Math.round(minsPerWeek / periodDuration)
      return {
        tscId:    tsc.id,
        teacherId: tsc.teacherId,
        subject:  tsc.subject.name,
        periodos: periodosSemanales,
        asignados: 0,
      }
    }).filter(m => m.periodos > 0)

    // 7. Calcular periodos de cada hora del día
    const periodTimes = calcularPeriodos(
      schoolSchedule.startTime,
      totalPeriods,
      periodDuration,
      schoolSchedule.breakDuration,
      schoolSchedule.breakAfter
    )

    // 8. Eliminar horario borrador existente
    await prisma.schedule.deleteMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id, status: 'BORRADOR' }
    })

    // 9. Generar distribución
    const created: any[] = []
    const errors:  any[] = []

    // Crear mapa de ocupación del maestro (teacherId → Set de "día-periodo")
    const maestroOcupado: Record<number, Set<string>> = {}

    // Cargar ocupaciones existentes (otros cursos ya publicados)
    const existingSchedules = await prisma.schedule.findMany({
      where: { academicYearId: activeYear.id, status: 'PUBLICADO' },
      include: { teacherSubjectCourse: { select: { teacherId: true } } }
    })
    existingSchedules.forEach(s => {
      const tid = s.teacherSubjectCourse.teacherId
      if (!maestroOcupado[tid]) maestroOcupado[tid] = new Set()
      maestroOcupado[tid].add(`${s.dayOfWeek}-${s.period}`)
    })

    // Distribuir periodos por día usando round-robin
    let dayIndex = 0
    for (const materia of materiasConPeriodos) {
      let pendientes = materia.periodos
      let intentos   = 0

      while (pendientes > 0 && intentos < totalPeriods * DAYS.length * 2) {
        intentos++
        const day    = DAYS[dayIndex % DAYS.length]
        dayIndex++

        // Buscar periodo libre en este día para este curso y maestro
        for (let p = 1; p <= totalPeriods; p++) {
          // Verificar que el periodo del curso esté libre
          const yaAsignado = created.find(c => c.dayOfWeek === day && c.period === p)
          if (yaAsignado) continue

          // Verificar que el maestro no esté ocupado
          const key = `${day}-${p}`
          if (!maestroOcupado[materia.teacherId]) maestroOcupado[materia.teacherId] = new Set()
          if (maestroOcupado[materia.teacherId].has(key)) continue

          // Asignar
          const pt = periodTimes[p - 1]
          created.push({
            courseId:              parseInt(courseId),
            academicYearId:        activeYear.id,
            dayOfWeek:             day,
            period:                p,
            startTime:             pt.startTime,
            endTime:               pt.endTime,
            teacherSubjectCourseId: materia.tscId,
            status:                'BORRADOR',
          })
          maestroOcupado[materia.teacherId].add(key)
          pendientes--
          break
        }
      }

      if (pendientes > 0) {
        errors.push({ subject: materia.subject, periodosFaltantes: pendientes })
      }
    }

    // 10. Guardar en BD
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
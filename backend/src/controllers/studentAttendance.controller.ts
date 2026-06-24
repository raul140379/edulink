import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/student-attendance/course/:courseId
// Obtener asistencia de un curso por fecha
// ─────────────────────────────────────────────
export const getAttendanceByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { date } = req.query

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    // Fecha base
    const base = date ? new Date(date as string) : new Date()
    base.setHours(0, 0, 0, 0)
    const next = new Date(base)
    next.setDate(next.getDate() + 1)

    // Estudiantes del curso
    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, gender: true } }
      },
      orderBy: { student: { lastName: 'asc' } }
    })

    // Asistencias del día
    const attendances = await prisma.studentAttendance.findMany({
      where: {
        courseId:      parseInt(courseId),
        academicYearId: activeYear.id,
        date: { gte: base, lt: next }
      }
    })

    const attendanceMap: Record<number, any> = {}
    attendances.forEach(a => { attendanceMap[a.studentId] = a })

    const result = assignments.map(a => ({
      studentId:   a.student.id,
      firstName:   a.student.firstName,
      lastName:    a.student.lastName,
      gender:      a.student.gender,
      attendance:  attendanceMap[a.student.id] || null,
      status:      attendanceMap[a.student.id]?.status || 'PRESENTE',
      note:        attendanceMap[a.student.id]?.note   || '',
    }))

    const summary = {
      total:     result.length,
      presentes: attendances.filter(a => a.status === 'PRESENTE').length,
      ausentes:  attendances.filter(a => a.status === 'AUSENTE').length,
      retrasos:  attendances.filter(a => a.status === 'RETRASO').length,
      licencias: attendances.filter(a => a.status === 'LICENCIA').length,
      registrado: attendances.length > 0,
    }

    res.json({ date: base.toISOString().split('T')[0], students: result, summary })
  } catch (error) {
    console.error('getAttendanceByCourse error:', error)
    res.status(500).json({ message: 'Error al obtener asistencia' })
  }
}

// ─────────────────────────────────────────────
// POST /api/student-attendance/course/:courseId
// Guardar asistencia masiva de un curso
// Body: { date, attendances: [{ studentId, status, note }] }
// ─────────────────────────────────────────────
export const saveAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { date, attendances } = req.body

    if (!attendances || !Array.isArray(attendances)) {
      res.status(400).json({ message: 'attendances es requerido' }); return
    }

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.userId },
      include: { user: true }
    })
    if (!teacher) { res.status(404).json({ message: 'Maestro no encontrado' }); return }

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }

    const base = date ? new Date(date) : new Date()
    base.setHours(0, 0, 0, 0)

    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const GRADES: Record<string, string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    const results = []
    const notificationsToSend = []

    for (const att of attendances) {
      // Guardar asistencia
      const record = await prisma.studentAttendance.upsert({
        where: {
          studentId_courseId_date: {
            studentId: parseInt(att.studentId),
            courseId:  parseInt(courseId),
            date:      base,
          }
        },
        update: {
          status:    att.status,
          note:      att.note || null,
          teacherId: teacher.id,
        },
        create: {
          studentId:      parseInt(att.studentId),
          courseId:       parseInt(courseId),
          teacherId:      teacher.id,
          academicYearId: activeYear.id,
          date:           base,
          status:         att.status,
          note:           att.note || null,
        }
      })
      results.push(record)

      // Solo notificar si es AUSENTE o RETRASO
      if (att.status === 'AUSENTE' || att.status === 'RETRASO') {
        notificationsToSend.push({ studentId: parseInt(att.studentId), status: att.status, note: att.note })
      }
    }

    // Enviar notificaciones a padres
    let notifCount = 0
    for (const n of notificationsToSend) {
      const statusLabel = n.status === 'AUSENTE' ? 'ausente' : 'con retraso'
      const emoji       = n.status === 'AUSENTE' ? '❌' : '⏰'
      const title   = `${emoji} Inasistencia — ${cursoLabel}`
      const message = `Su hijo/a estuvo ${statusLabel} el ${dateStr} en el curso ${cursoLabel}. Maestro: ${teacher.lastName} ${teacher.firstName}.${n.note ? ` Observación: ${n.note}` : ''}`

      // Buscar tutor legal del estudiante
      const parentLink = await prisma.parentStudent.findFirst({
        where: { studentId: n.studentId, isTutor: true },
        include: { parent: { select: { id: true, userId: true } } }
      })

      if (parentLink?.parent) {
        await prisma.notification.create({
          data: {
            title,
            message,
            type:     'ACADEMICA',
            sentById: teacher.userId,
            parentId: parentLink.parent.id,
          }
        })
        notifCount++
      }
    }

    res.json({
      message: `Asistencia guardada: ${results.length} registros${notifCount > 0 ? ` · ${notifCount} notificación(es) enviada(s)` : ''}`,
      count:   results.length,
      notifications: notifCount,
    })
  } catch (error) {
    console.error('saveAttendance error:', error)
    res.status(500).json({ message: 'Error al guardar asistencia' })
  }
}

// ─────────────────────────────────────────────
// GET /api/student-attendance/my-courses
// Cursos del maestro autenticado
// ─────────────────────────────────────────────
export const getMyCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.userId } })
    if (!teacher) { res.status(404).json({ message: 'Maestro no encontrado' }); return }

    const assignments = await prisma.teacherSubjectCourse.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true, course: true },
      distinct: ['courseId'],
    })

    const courses = assignments.map(a => a.course)
    res.json(courses)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cursos' })
  }
}

// ─────────────────────────────────────────────
// GET /api/student-attendance/history/:studentId
// Historial de asistencia de un estudiante
// ─────────────────────────────────────────────
export const getStudentHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params
    const { courseId, month } = req.query

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    let dateFilter: any = {}
    if (month) {
      const [year, m] = (month as string).split('-').map(Number)
      const start = new Date(year, m - 1, 1)
      const end   = new Date(year, m, 1)
      dateFilter = { gte: start, lt: end }
    }

    const attendances = await prisma.studentAttendance.findMany({
      where: {
        studentId:     parseInt(studentId),
        academicYearId: activeYear.id,
        ...(courseId ? { courseId: parseInt(courseId as string) } : {}),
        ...(month    ? { date: dateFilter } : {}),
      },
      orderBy: { date: 'desc' }
    })

    const summary = {
      total:     attendances.length,
      presentes: attendances.filter(a => a.status === 'PRESENTE').length,
      ausentes:  attendances.filter(a => a.status === 'AUSENTE').length,
      retrasos:  attendances.filter(a => a.status === 'RETRASO').length,
      licencias: attendances.filter(a => a.status === 'LICENCIA').length,
    }

    res.json({ attendances, summary })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial' })
  }
}
// ─────────────────────────────────────────────
// POST /api/student-attendance/course/:courseId/close
// Cierra la asistencia: marca como AUSENTE todos los sin registro
// ─────────────────────────────────────────────
export const closeAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { date } = req.body

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.userId },
      include: { user: true }
    })
    if (!teacher) { res.status(404).json({ message: 'Maestro no encontrado' }); return }

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }

    const base = date ? new Date(date) : new Date()
    base.setHours(0, 0, 0, 0)
    const next = new Date(base)
    next.setDate(next.getDate() + 1)

    const GRADES: Record<string, string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
    const dateStr   = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    // Obtener todos los estudiantes del curso
    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id },
      select: { studentId: true }
    })

    // Obtener asistencias ya registradas hoy
    const existing = await prisma.studentAttendance.findMany({
      where: {
        courseId:       parseInt(courseId),
        academicYearId: activeYear.id,
        date: { gte: base, lt: next }
      },
      select: { studentId: true }
    })

    const registeredIds = new Set(existing.map(e => e.studentId))
    const sinRegistro   = assignments.filter(a => !registeredIds.has(a.studentId))

    if (sinRegistro.length === 0) {
      res.json({ message: 'Todos los estudiantes ya tienen asistencia registrada', count: 0, notifications: 0 })
      return
    }

    // Marcar como AUSENTE los sin registro y notificar
    let notifCount = 0
    for (const a of sinRegistro) {
      await prisma.studentAttendance.create({
        data: {
          studentId:      a.studentId,
          courseId:       parseInt(courseId),
          teacherId:      teacher.id,
          academicYearId: activeYear.id,
          date:           base,
          status:         'AUSENTE',
          note:           'Registrado automáticamente al cerrar asistencia',
        }
      })

      // Notificar al tutor legal
      const parentLink = await prisma.parentStudent.findFirst({
        where: { studentId: a.studentId, isTutor: true },
        include: { parent: { select: { id: true } } }
      })

      if (parentLink?.parent) {
        await prisma.notification.create({
          data: {
            title:   `❌ Inasistencia — ${cursoLabel}`,
            message: `Su hijo/a estuvo ausente el ${dateStr} en el curso ${cursoLabel}. Maestro: ${teacher.lastName} ${teacher.firstName}.`,
            type:    'ACADEMICA',
            sentById: teacher.userId,
            parentId: parentLink.parent.id,
          }
        })
        notifCount++
      }
    }

    res.json({
      message: `Asistencia cerrada: ${sinRegistro.length} estudiante(s) marcado(s) como ausente · ${notifCount} notificación(es) enviada(s)`,
      count:       sinRegistro.length,
      notifications: notifCount,
    })
  } catch (error) {
    console.error('closeAttendance error:', error)
    res.status(500).json({ message: 'Error al cerrar asistencia' })
  }
}
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────
const startOfDay = (date: Date) => {
  const d = new Date(date); d.setHours(0, 0, 0, 0); return d
}
const endOfDay = (date: Date) => {
  const d = new Date(date); d.setHours(23, 59, 59, 999); return d
}
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' })

// Verificar si llegó tarde comparando con hora configurada del maestro
// Si el maestro no tiene hora configurada, usa el horario institucional del turno
const checkIsRetraso = async (teacherId: number, now: Date): Promise<boolean> => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { entryTime: true, toleranceMin: true }
  })

  // Si el maestro tiene hora configurada, usarla
  if (teacher?.entryTime) {
    const [entryHour, entryMin] = teacher.entryTime.split(':').map(Number)
    const tolerance = teacher.toleranceMin ?? 10
    const entryLimit = new Date(now)
    entryLimit.setHours(entryHour, entryMin + tolerance, 0, 0)
    return now > entryLimit
  }

  // Si no tiene hora, buscar horario institucional por turno
  // Por defecto verificar si llegó después de las 8:00 AM con 10 min tolerancia
  const hour   = now.getHours()
  const minute = now.getMinutes()
  return hour > 8 || (hour === 8 && minute > 10)
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/check-in
// ─────────────────────────────────────────────
export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil de maestro no encontrado' }); return }

    const today = new Date()
    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: startOfDay(today), lte: endOfDay(today) } }
    })

    if (existing?.checkIn) {
      res.status(400).json({ message: 'Ya registraste tu entrada hoy', attendance: existing }); return
    }

    const isRetraso = await checkIsRetraso(teacher.id, today)

    if (existing) {
      const updated = await prisma.teacherAttendance.update({
        where: { id: existing.id },
        data:  { checkIn: today, status: isRetraso ? 'RETRASO' : 'PRESENTE' }
      })
      res.json({ message: isRetraso ? 'Entrada registrada con retraso' : 'Entrada registrada correctamente', attendance: updated }); return
    }

    const attendance = await prisma.teacherAttendance.create({
      data: { teacherId: teacher.id, date: today, checkIn: today, status: isRetraso ? 'RETRASO' : 'PRESENTE' }
    })

    res.status(201).json({
      message: isRetraso ? 'Entrada registrada con retraso' : 'Entrada registrada correctamente',
      attendance
    })
  } catch (error) {
    console.error('checkIn error:', error)
    res.status(500).json({ message: 'Error al registrar entrada' })
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/check-out
// ─────────────────────────────────────────────
export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil de maestro no encontrado' }); return }

    const today = new Date()
    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: startOfDay(today), lte: endOfDay(today) } }
    })

    if (!existing?.checkIn) {
      res.status(400).json({ message: 'No has registrado tu entrada hoy. Marca entrada primero.' }); return
    }
    if (existing.checkOut) {
      res.status(400).json({ message: 'Ya registraste tu salida hoy', attendance: existing }); return
    }

    const updated = await prisma.teacherAttendance.update({
      where: { id: existing.id },
      data:  { checkOut: today }
    })

    res.json({ message: 'Salida registrada correctamente', attendance: updated })
  } catch (error) {
    console.error('checkOut error:', error)
    res.status(500).json({ message: 'Error al registrar salida' })
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/my-today
// ─────────────────────────────────────────────
export const getMyToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil no encontrado' }); return }

    const today = new Date()
    const attendance = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: startOfDay(today), lte: endOfDay(today) } }
    })

    res.json(attendance || null)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener asistencia' })
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/my-history
// ─────────────────────────────────────────────
export const getMyHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil no encontrado' }); return }

    const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1
    const year  = req.query.year  ? parseInt(req.query.year  as string) : new Date().getFullYear()

    const records = await prisma.teacherAttendance.findMany({
      where: { teacherId: teacher.id, date: { gte: new Date(year, month-1, 1), lte: new Date(year, month, 0, 23, 59, 59) } },
      orderBy: { date: 'asc' }
    })

    const summary = {
      presente: records.filter(r => r.status === 'PRESENTE').length,
      retraso:  records.filter(r => r.status === 'RETRASO').length,
      ausente:  records.filter(r => r.status === 'AUSENTE').length,
      licencia: records.filter(r => r.status === 'LICENCIA').length,
      total:    records.length,
    }

    res.json({ records, summary, month, year })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial' })
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/report
// ─────────────────────────────────────────────
export const getReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month     = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1
    const year      = req.query.year  ? parseInt(req.query.year  as string) : new Date().getFullYear()
    const week      = req.query.week  ? parseInt(req.query.week  as string) : null
    const date      = req.query.date  as string | undefined
    const teacherId = req.query.teacherId ? parseInt(req.query.teacherId as string) : undefined

    let start: Date, end: Date

    if (date) {
      const d = new Date(date)
      start = startOfDay(d)
      end   = endOfDay(d)
    } else if (week) {
      const firstDay    = new Date(year, month - 1, 1)
      const dayOfWeek   = firstDay.getDay()
      const firstMonday = new Date(firstDay)
      firstMonday.setDate(firstDay.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7)
      start = new Date(firstMonday)
      start.setDate(firstMonday.getDate() + (week - 1) * 7)
      end   = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59)
    } else {
      start = new Date(year, month - 1, 1)
      end   = new Date(year, month, 0, 23, 59, 59)
    }

    const records = await prisma.teacherAttendance.findMany({
      where: { date: { gte: start, lte: end }, ...(teacherId ? { teacherId } : {}) },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, ci: true, phone: true, entryTime: true, exitTime: true } } },
      orderBy: [{ teacher: { lastName: 'asc' } }, { date: 'asc' }]
    })

    const byTeacher: Record<number, any> = {}
    records.forEach(r => {
      const tid = r.teacherId
      if (!byTeacher[tid]) {
        byTeacher[tid] = {
          teacher:  r.teacher,
          records:  [],
          summary:  { presente: 0, retraso: 0, ausente: 0, licencia: 0, total: 0 }
        }
      }
      byTeacher[tid].records.push(r)
      const key = r.status.toLowerCase() as keyof typeof byTeacher[typeof tid]['summary']
      if (key in byTeacher[tid].summary) byTeacher[tid].summary[key]++
      byTeacher[tid].summary.total++
    })

    res.json({ period: { start, end, month, year, week, date }, teachers: Object.values(byTeacher), totalRecords: records.length })
  } catch (error) {
    console.error('getReport error:', error)
    res.status(500).json({ message: 'Error al generar reporte' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teacher-attendance/:id
// ─────────────────────────────────────────────
export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { status, note, checkIn, checkOut } = req.body
    const updated = await prisma.teacherAttendance.update({
      where: { id: parseInt(id) },
      data: {
        ...(status   ? { status }                        : {}),
        ...(note     ? { note }                          : {}),
        ...(checkIn  ? { checkIn:  new Date(checkIn)  } : {}),
        ...(checkOut ? { checkOut: new Date(checkOut) } : {}),
      }
    })
    res.json({ message: 'Asistencia actualizada', attendance: updated })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar asistencia' })
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/mark-absent
// ─────────────────────────────────────────────
export const markAbsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today    = new Date()
    const teachers = await prisma.teacher.findMany({ where: { isActive: true } })
    const existing = await prisma.teacherAttendance.findMany({
      where: { date: { gte: startOfDay(today), lte: endOfDay(today) } },
      select: { teacherId: true }
    })
    const existingIds     = new Set(existing.map(e => e.teacherId))
    const absentTeachers  = teachers.filter(t => !existingIds.has(t.id))

    if (absentTeachers.length === 0) {
      res.json({ message: 'Todos los maestros ya tienen registro hoy', marked: 0 }); return
    }

    await prisma.teacherAttendance.createMany({
      data: absentTeachers.map(t => ({ teacherId: t.id, date: today, status: 'AUSENTE' as any })),
      skipDuplicates: true,
    })

    res.json({ message: `${absentTeachers.length} maestros marcados como ausentes`, marked: absentTeachers.length })
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar ausentes' })
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/public/check-in
// ─────────────────────────────────────────────
export const publicCheckIn = async (req: any, res: Response): Promise<void> => {
  try {
    const { code } = req.body
    if (!code) { res.status(400).json({ message: 'Código requerido' }); return }

    const teacher = await prisma.teacher.findUnique({
      where: { attendanceCode: code.trim().toUpperCase() },
      select: { id: true, firstName: true, lastName: true, entryTime: true, toleranceMin: true }
    })
    if (!teacher) { res.status(404).json({ message: 'Código inválido' }); return }

    const today = new Date()
    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: startOfDay(today), lte: endOfDay(today) } }
    })

    if (existing?.checkIn) {
      res.status(400).json({
        message: `${teacher.lastName} ${teacher.firstName} — ya registraste tu entrada hoy a las ${fmtTime(existing.checkIn.toISOString())}`,
        attendance: existing
      }); return
    }

    const isRetraso = await checkIsRetraso(teacher.id, today)

    let attendance
    if (existing) {
      attendance = await prisma.teacherAttendance.update({
        where: { id: existing.id },
        data:  { checkIn: today, status: isRetraso ? 'RETRASO' : 'PRESENTE' }
      })
    } else {
      attendance = await prisma.teacherAttendance.create({
        data: { teacherId: teacher.id, date: today, checkIn: today, status: isRetraso ? 'RETRASO' : 'PRESENTE' }
      })
    }

    res.json({
      message: `✅ ${teacher.lastName} ${teacher.firstName} — ${isRetraso ? 'Entrada con retraso' : 'Entrada registrada'} a las ${fmtTime(today.toISOString())}`,
      teacher,
      attendance,
    })
  } catch (error) {
    console.error('publicCheckIn error:', error)
    res.status(500).json({ message: 'Error al registrar entrada' })
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/public/check-out
// ─────────────────────────────────────────────
export const publicCheckOut = async (req: any, res: Response): Promise<void> => {
  try {
    const { code } = req.body
    if (!code) { res.status(400).json({ message: 'Código requerido' }); return }

    const teacher = await prisma.teacher.findUnique({
      where: { attendanceCode: code.trim().toUpperCase() },
      select: { id: true, firstName: true, lastName: true }
    })
    if (!teacher) { res.status(404).json({ message: 'Código inválido' }); return }

    const today = new Date()
    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: startOfDay(today), lte: endOfDay(today) } }
    })

    if (!existing?.checkIn) {
      res.status(400).json({ message: 'No has registrado tu entrada hoy' }); return
    }
    if (existing.checkOut) {
      res.status(400).json({
        message: `${teacher.lastName} ${teacher.firstName} — ya registraste tu salida hoy a las ${fmtTime(existing.checkOut.toISOString())}`
      }); return
    }

    const updated = await prisma.teacherAttendance.update({
      where: { id: existing.id },
      data:  { checkOut: today }
    })

    res.json({
      message: `✅ ${teacher.lastName} ${teacher.firstName} — Salida registrada a las ${fmtTime(today.toISOString())}`,
      teacher,
      attendance: updated,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar salida' })
  }
}
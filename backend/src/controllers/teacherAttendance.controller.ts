import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ── Helper: obtener inicio y fin del día ──────────────────────────
const startOfDay = (date: Date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
const endOfDay = (date: Date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/check-in
// Maestro marca su entrada
// ─────────────────────────────────────────────
export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil de maestro no encontrado' }); return }

    const today = new Date()
    const start = startOfDay(today)
    const end   = endOfDay(today)

    // Verificar si ya marcó entrada hoy
    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: start, lte: end } }
    })

    if (existing) {
      if (existing.checkIn) {
        res.status(400).json({ message: 'Ya registraste tu entrada hoy', attendance: existing }); return
      }
      // Actualizar registro existente con hora de entrada
      const updated = await prisma.teacherAttendance.update({
        where: { id: existing.id },
        data:  { checkIn: today, status: 'PRESENTE' }
      })
      res.json({ message: 'Entrada registrada correctamente', attendance: updated }); return
    }

    // Verificar si es tardanza (después de las 8:30 AM)
    const hour   = today.getHours()
    const minute = today.getMinutes()
    const isTardanza = hour > 8 || (hour === 8 && minute > 30)

    const attendance = await prisma.teacherAttendance.create({
      data: {
        teacherId: teacher.id,
        date:      today,
        checkIn:   today,
        status:    isTardanza ? 'TARDANZA' : 'PRESENTE',
      }
    })

    res.status(201).json({
      message: isTardanza ? 'Entrada registrada con tardanza' : 'Entrada registrada correctamente',
      attendance
    })
  } catch (error) {
    console.error('checkIn error:', error)
    res.status(500).json({ message: 'Error al registrar entrada' })
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/check-out
// Maestro marca su salida
// ─────────────────────────────────────────────
export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil de maestro no encontrado' }); return }

    const today = new Date()
    const start = startOfDay(today)
    const end   = endOfDay(today)

    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: start, lte: end } }
    })

    if (!existing) {
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
// Estado de asistencia del maestro hoy
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
// GET /api/teacher-attendance/my-history?month=6&year=2026
// Historial del maestro logueado
// ─────────────────────────────────────────────
export const getMyHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(404).json({ message: 'Perfil no encontrado' }); return }

    const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1
    const year  = req.query.year  ? parseInt(req.query.year  as string) : new Date().getFullYear()

    const start = new Date(year, month - 1, 1)
    const end   = new Date(year, month, 0, 23, 59, 59)

    const records = await prisma.teacherAttendance.findMany({
      where: { teacherId: teacher.id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' }
    })

    const summary = {
      presente:  records.filter(r => r.status === 'PRESENTE').length,
      tardanza:  records.filter(r => r.status === 'TARDANZA').length,
      ausente:   records.filter(r => r.status === 'AUSENTE').length,
      licencia:  records.filter(r => r.status === 'LICENCIA').length,
      total:     records.length,
    }

    res.json({ records, summary, month, year })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial' })
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/report?month=6&year=2026&week=1
// Reporte para admin/director/secretaria/junta
// ─────────────────────────────────────────────
export const getReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month  = req.query.month  ? parseInt(req.query.month  as string) : new Date().getMonth() + 1
    const year   = req.query.year   ? parseInt(req.query.year   as string) : new Date().getFullYear()
    const week   = req.query.week   ? parseInt(req.query.week   as string) : null
    const teacherId = req.query.teacherId ? parseInt(req.query.teacherId as string) : undefined

    let start: Date, end: Date

    if (week) {
      // Semana específica del mes
      const firstDay = new Date(year, month - 1, 1)
      const dayOfWeek = firstDay.getDay()
      const firstMonday = new Date(firstDay)
      firstMonday.setDate(firstDay.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7)
      start = new Date(firstMonday)
      start.setDate(firstMonday.getDate() + (week - 1) * 7)
      end   = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59)
    } else {
      // Mes completo
      start = new Date(year, month - 1, 1)
      end   = new Date(year, month, 0, 23, 59, 59)
    }

    const records = await prisma.teacherAttendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(teacherId ? { teacherId } : {})
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } }
      },
      orderBy: [{ teacher: { lastName: 'asc' } }, { date: 'asc' }]
    })

    // Agrupar por maestro
    const byTeacher: Record<number, any> = {}
    records.forEach(r => {
      const tid = r.teacherId
      if (!byTeacher[tid]) {
        byTeacher[tid] = {
          teacher:  r.teacher,
          records:  [],
          summary:  { presente: 0, tardanza: 0, ausente: 0, licencia: 0, total: 0 }
        }
      }
      byTeacher[tid].records.push(r)
      byTeacher[tid].summary[r.status.toLowerCase()]++
      byTeacher[tid].summary.total++
    })

    res.json({
      period: { start, end, month, year, week },
      teachers: Object.values(byTeacher),
      totalRecords: records.length,
    })
  } catch (error) {
    console.error('getReport error:', error)
    res.status(500).json({ message: 'Error al generar reporte' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teacher-attendance/:id
// Admin puede editar estado (marcar ausente, licencia, etc.)
// ─────────────────────────────────────────────
export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { status, note, checkIn, checkOut } = req.body

    const updated = await prisma.teacherAttendance.update({
      where: { id: parseInt(id) },
      data: {
        ...(status   ? { status }                              : {}),
        ...(note     ? { note }                                : {}),
        ...(checkIn  ? { checkIn:  new Date(checkIn)  }       : {}),
        ...(checkOut ? { checkOut: new Date(checkOut) }       : {}),
      }
    })

    res.json({ message: 'Asistencia actualizada', attendance: updated })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar asistencia' })
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/mark-absent
// Admin marca ausentes a los maestros que no registraron entrada
// ─────────────────────────────────────────────
export const markAbsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date()
    const start = startOfDay(today)
    const end   = endOfDay(today)

    // Obtener todos los maestros activos
    const teachers = await prisma.teacher.findMany({ where: { isActive: true } })

    // Obtener los que ya tienen registro hoy
    const existing = await prisma.teacherAttendance.findMany({
      where: { date: { gte: start, lte: end } },
      select: { teacherId: true }
    })
    const existingIds = new Set(existing.map(e => e.teacherId))

    // Marcar ausentes a los que no registraron
    const absentTeachers = teachers.filter(t => !existingIds.has(t.id))
    if (absentTeachers.length === 0) {
      res.json({ message: 'Todos los maestros ya tienen registro hoy', marked: 0 }); return
    }

    await prisma.teacherAttendance.createMany({
      data: absentTeachers.map(t => ({
        teacherId: t.id,
        date:      today,
        status:    'AUSENTE' as any,
      })),
      skipDuplicates: true,
    })

    res.json({ message: `${absentTeachers.length} maestros marcados como ausentes`, marked: absentTeachers.length })
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar ausentes' })
  }
}
// ─────────────────────────────────────────────
// POST /api/teacher-attendance/public/check-in
// Marcar entrada con código — sin login
// ─────────────────────────────────────────────
export const publicCheckIn = async (req: any, res: Response): Promise<void> => {
  try {
    const { code } = req.body
    if (!code) { res.status(400).json({ message: 'Código requerido' }); return }

    const teacher = await prisma.teacher.findUnique({
      where: { attendanceCode: code.trim().toUpperCase() },
      select: { id: true, firstName: true, lastName: true }
    })
    if (!teacher) { res.status(404).json({ message: 'Código inválido' }); return }

    const today = new Date()
    const start = startOfDay(today)
    const end   = endOfDay(today)

    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: start, lte: end } }
    })

    if (existing?.checkIn) {
      res.status(400).json({ message: `${teacher.lastName} ${teacher.firstName} — ya registraste tu entrada hoy a las ${fmtTime(existing.checkIn.toISOString())}`, attendance: existing }); return
    }

    const hour     = today.getHours()
    const minute   = today.getMinutes()
    const isTardanza = hour > 8 || (hour === 8 && minute > 30)

    let attendance
    if (existing) {
      attendance = await prisma.teacherAttendance.update({
        where: { id: existing.id },
        data:  { checkIn: today, status: isTardanza ? 'TARDANZA' : 'PRESENTE' }
      })
    } else {
      attendance = await prisma.teacherAttendance.create({
        data: {
          teacherId: teacher.id,
          date:      today,
          checkIn:   today,
          status:    isTardanza ? 'TARDANZA' : 'PRESENTE',
        }
      })
    }

    res.json({
      message:  `✅ ${teacher.lastName} ${teacher.firstName} — ${isTardanza ? 'Entrada con tardanza' : 'Entrada registrada'} a las ${fmtTime(today.toISOString())}`,
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
// Marcar salida con código — sin login
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
    const start = startOfDay(today)
    const end   = endOfDay(today)

    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, date: { gte: start, lte: end } }
    })

    if (!existing?.checkIn) {
      res.status(400).json({ message: 'No has registrado tu entrada hoy' }); return
    }
    if (existing.checkOut) {
      res.status(400).json({ message: `${teacher.lastName} ${teacher.firstName} — ya registraste tu salida hoy a las ${fmtTime(existing.checkOut.toISOString())}` }); return
    }

    const updated = await prisma.teacherAttendance.update({
      where: { id: existing.id },
      data:  { checkOut: today }
    })

    res.json({
      message:  `✅ ${teacher.lastName} ${teacher.firstName} — Salida registrada a las ${fmtTime(today.toISOString())}`,
      teacher,
      attendance: updated,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar salida' })
  }
}

// Helper local
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' })
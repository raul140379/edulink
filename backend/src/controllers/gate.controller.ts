import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/gate/teacher/:code
// Buscar maestro por código de asistencia
// ─────────────────────────────────────────────
export const getTeacherByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.params

    const teacher = await prisma.teacher.findUnique({
      where: { attendanceCode: code.toUpperCase() },
      select: {
        id: true, firstName: true, lastName: true,
        specialty: true, attendanceCode: true, isActive: true,
        entryTime: true, exitTime: true,
      }
    })

    if (!teacher) {
      res.status(404).json({ message: 'Código no encontrado' }); return
    }

    if (!teacher.isActive) {
      res.status(400).json({ message: 'Maestro inactivo' }); return
    }

    // Verificar último registro del día para saber si es ENTRADA o SALIDA
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const lastRecord = await prisma.gateRecord.findFirst({
      where: {
        teacherId: teacher.id,
        type: 'MAESTRO',
        createdAt: { gte: today, lt: tomorrow }
      },
      orderBy: { createdAt: 'desc' }
    })

    const nextAction = !lastRecord || lastRecord.action === 'SALIDA' ? 'ENTRADA' : 'SALIDA'

    res.json({ teacher, nextAction, lastRecord })
  } catch (error) {
    console.error('getTeacherByCode error:', error)
    res.status(500).json({ message: 'Error al buscar maestro' })
  }
}

// ─────────────────────────────────────────────
// POST /api/gate/teacher
// Registrar entrada/salida de maestro
// ─────────────────────────────────────────────
export const registerTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, action, note } = req.body

    if (!teacherId || !action) {
      res.status(400).json({ message: 'teacherId y action son requeridos' }); return
    }

    if (!['ENTRADA', 'SALIDA'].includes(action)) {
      res.status(400).json({ message: 'action debe ser ENTRADA o SALIDA' }); return
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: parseInt(teacherId) } })
    if (!teacher) { res.status(404).json({ message: 'Maestro no encontrado' }); return }

    const record = await prisma.gateRecord.create({
      data: {
        type:            'MAESTRO',
        action,
        teacherId:       parseInt(teacherId),
        registeredById:  req.userId,
        note:            note || null,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, attendanceCode: true } }
      }
    })

    res.status(201).json({
      message: `${action} de ${teacher.lastName} ${teacher.firstName} registrada`,
      record
    })
  } catch (error) {
    console.error('registerTeacher error:', error)
    res.status(500).json({ message: 'Error al registrar' })
  }
}

// ─────────────────────────────────────────────
// POST /api/gate/visitor
// Registrar entrada/salida de visitante
// ─────────────────────────────────────────────
export const registerVisitor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitorName, visitorCI, reason, destination, action, note } = req.body

    if (!visitorName || !action) {
      res.status(400).json({ message: 'Nombre y acción son requeridos' }); return
    }

    const record = await prisma.gateRecord.create({
      data: {
        type:            'VISITANTE',
        action,
        visitorName,
        visitorCI:       visitorCI || null,
        reason:          reason    || null,
        destination:     destination || null,
        registeredById:  req.userId,
        note:            note || null,
      }
    })

    res.status(201).json({
      message: `${action} de visitante "${visitorName}" registrada`,
      record
    })
  } catch (error) {
    console.error('registerVisitor error:', error)
    res.status(500).json({ message: 'Error al registrar visitante' })
  }
}

// ─────────────────────────────────────────────
// GET /api/gate/records
// Listar registros del día (para admin)
// Query params: date, type, action
// ─────────────────────────────────────────────
export const getRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, type, action } = req.query

    // Fecha base — hoy por defecto
    const base = date ? new Date(date as string) : new Date()
    base.setHours(0, 0, 0, 0)
    const next = new Date(base)
    next.setDate(next.getDate() + 1)

    const records = await prisma.gateRecord.findMany({
      where: {
        createdAt: { gte: base, lt: next },
        ...(type   ? { type:   type   as any } : {}),
        ...(action ? { action: action as any } : {}),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, specialty: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Resumen del día
    const totalMaestros  = records.filter(r => r.type === 'MAESTRO').length
    const totalVisitantes = records.filter(r => r.type === 'VISITANTE').length
    const entradas       = records.filter(r => r.action === 'ENTRADA').length
    const salidas        = records.filter(r => r.action === 'SALIDA').length

    res.json({ records, summary: { totalMaestros, totalVisitantes, entradas, salidas, total: records.length } })
  } catch (error) {
    console.error('getRecords error:', error)
    res.status(500).json({ message: 'Error al obtener registros' })
  }
}

// ─────────────────────────────────────────────
// GET /api/gate/records/today-teachers
// Maestros con entrada hoy (para portero)
// ─────────────────────────────────────────────
export const getTodayTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const records = await prisma.gateRecord.findMany({
      where: {
        type:      'MAESTRO',
        createdAt: { gte: today, lt: tomorrow }
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Agrupar por maestro: solo el último registro
    const byTeacher: Record<number, any> = {}
    for (const r of records) {
      if (!r.teacherId) continue
      if (!byTeacher[r.teacherId]) byTeacher[r.teacherId] = r
    }

    res.json(Object.values(byTeacher))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener maestros del día' })
  }
}
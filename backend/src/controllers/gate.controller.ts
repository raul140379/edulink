import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function startOfDay(d: Date) {
  const s = new Date(d); s.setHours(0, 0, 0, 0); return s
}
function endOfDay(d: Date) {
  const e = new Date(d); e.setHours(23, 59, 59, 999); return e
}
function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Roles administrativos fijos (siempre esperados)
const ADMIN_ROLES = ['DIRECTOR', 'REGENTE', 'SECRETARY', 'STAFF']

// ─────────────────────────────────────────────
// GET /api/gate/teacher/:code
// Buscar maestro por código QR
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

    if (!teacher) { res.status(404).json({ message: 'Código no encontrado' }); return }
    if (!teacher.isActive) { res.status(400).json({ message: 'Maestro inactivo' }); return }

    const today    = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const lastRecord = await prisma.gateRecord.findFirst({
      where: { teacherId: teacher.id, type: 'MAESTRO', createdAt: { gte: today, lt: tomorrow } },
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
// GET /api/gate/staff/:code
// Buscar personal administrativo por código QR
// ─────────────────────────────────────────────
export const getStaffByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.params

    const staff = await prisma.staff.findUnique({
      where: { attendanceCode: code.toUpperCase() },
      select: {
        id: true, firstName: true, lastName: true,
        staffRole: true, attendanceCode: true, isActive: true,
      }
    })

    if (!staff) { res.status(404).json({ message: 'Código no encontrado' }); return }
    if (!staff.isActive) { res.status(400).json({ message: 'Personal inactivo' }); return }

    const today    = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const lastRecord = await prisma.gateRecord.findFirst({
      where: { staffId: staff.id, type: 'ADMINISTRATIVO', createdAt: { gte: today, lt: tomorrow } },
      orderBy: { createdAt: 'desc' }
    })

    const nextAction = !lastRecord || lastRecord.action === 'SALIDA' ? 'ENTRADA' : 'SALIDA'
    res.json({ staff, nextAction, lastRecord })
  } catch (error) {
    console.error('getStaffByCode error:', error)
    res.status(500).json({ message: 'Error al buscar personal' })
  }
}

// ─────────────────────────────────────────────
// GET /api/gate/expected-today
// Lista de personas esperadas hoy:
// - Maestros con períodos asignados hoy
// - Personal administrativo (siempre)
// Incluye estado de registro y ventana de 30 min
// ─────────────────────────────────────────────
export const getExpectedToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now      = new Date()
    const todayDow = now.getDay() // 0=Dom, 1=Lun...6=Sab
    const today    = startOfDay(now)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    // Horario activo
    const schedule = await prisma.schoolSchedule.findFirst({ where: { isActive: true } })
    if (!schedule) { res.status(404).json({ message: 'No hay horario activo' }); return }

    // Ventana: 30 min antes del cierre
    const exitMin    = parseTime(schedule.exitTime)
    const nowMin     = now.getHours() * 60 + now.getMinutes()
    const diffToExit = exitMin - nowMin
    const windowOpen = diffToExit >= 0 && diffToExit <= 30

    // ── Maestros con períodos hoy ──────────────────
    const schedulesToday = await prisma.schedule.findMany({
      where: {
        dayOfWeek: todayDow,
        status:    { in: ['BORRADOR', 'PUBLICADO'] },
        teacherSubjectCourse: { teacherId: { not: undefined } }
      },
      select: {
        teacherSubjectCourse: {
          select: {
            teacher: {
              select: { id: true, firstName: true, lastName: true, ci: true, attendanceCode: true }
            }
          }
        }
      }
    })

    // Deduplicar por teacherId
    const teacherMap = new Map<number, any>()
    for (const s of schedulesToday) {
      const t = s.teacherSubjectCourse?.teacher
      if (t && !teacherMap.has(t.id)) teacherMap.set(t.id, t)
    }
    const teachersToday = Array.from(teacherMap.values())

    // Registros de entrada hoy para maestros
    const teacherIds = teachersToday.map(t => t.id)
    const teacherRecords = await prisma.gateRecord.findMany({
      where: {
        teacherId: { in: teacherIds },
        type:      'MAESTRO',
        action:    'ENTRADA',
        createdAt: { gte: today, lt: tomorrow }
      }
    })
    const teacherRecordMap = new Map(teacherRecords.map(r => [r.teacherId, r]))

    // TeacherAttendance de hoy (para saber si ya fue marcado AUSENTE)
    const teacherAttendances = await prisma.teacherAttendance.findMany({
      where: {
        teacherId: { in: teacherIds },
        date:      { gte: today, lte: endOfDay(now) }
      }
    })
    const attendanceMap = new Map(teacherAttendances.map(a => [a.teacherId, a]))

    const teachers = teachersToday.map(t => ({
      id:            t.id,
      firstName:     t.firstName,
      lastName:      t.lastName,
      ci:            t.ci,
      attendanceCode:t.attendanceCode,
      category:      'MAESTRO',
      gateRecord:    teacherRecordMap.get(t.id) || null,
      attendance:    attendanceMap.get(t.id)    || null,
      registered:    teacherRecordMap.has(t.id),
      isAbsent:      attendanceMap.get(t.id)?.status === 'AUSENTE',
    }))

    // ── Personal administrativo (siempre esperado) ──
    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, ci: true, staffRole: true, attendanceCode: true }
    })

    const staffIds = staffList.map(s => s.id)
    const staffRecords = await prisma.gateRecord.findMany({
      where: {
        staffId:   { in: staffIds },
        type:      'ADMINISTRATIVO',
        action:    'ENTRADA',
        createdAt: { gte: today, lt: tomorrow }
      }
    })
    const staffRecordMap = new Map(staffRecords.map(r => [r.staffId, r]))

    const staff = staffList.map(s => ({
      id:            s.id,
      firstName:     s.firstName,
      lastName:      s.lastName,
      ci:            s.ci,
      attendanceCode:s.attendanceCode,
      category:      s.staffRole,
      gateRecord:    staffRecordMap.get(s.id) || null,
      registered:    staffRecordMap.has(s.id),
      isAbsent:      false,
    }))

    res.json({
      schedule: {
        startTime:       schedule.startTime,
        exitTime:        schedule.exitTime,
        windowOpen,
        minutesBeforeExit: Math.max(0, diffToExit),
      },
      teachers,
      staff,
      summary: {
        teachersExpected:    teachers.length,
        teachersRegistered:  teachers.filter(t => t.registered).length,
        staffExpected:       staff.length,
        staffRegistered:     staff.filter(s => s.registered).length,
      }
    })
  } catch (error) {
    console.error('getExpectedToday error:', error)
    res.status(500).json({ message: 'Error al obtener lista del día' })
  }
}

// ─────────────────────────────────────────────
// POST /api/gate/teacher
// Registrar entrada/salida de maestro
// Body: { teacherId, action, method?, note? }
// ─────────────────────────────────────────────
export const registerTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, action, method, note } = req.body

    if (!teacherId || !action) {
      res.status(400).json({ message: 'teacherId y action son requeridos' }); return
    }
    if (!['ENTRADA', 'SALIDA'].includes(action)) {
      res.status(400).json({ message: 'action debe ser ENTRADA o SALIDA' }); return
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: parseInt(teacherId) } })
    if (!teacher) { res.status(404).json({ message: 'Maestro no encontrado' }); return }

    // Validar ventana de 30 min si es ENTRADA
    if (action === 'ENTRADA') {
      const schedule = await prisma.schoolSchedule.findFirst({ where: { isActive: true } })
      if (schedule) {
        const now      = new Date()
        const exitMin  = parseTime(schedule.exitTime)
        const nowMin   = now.getHours() * 60 + now.getMinutes()
        const diff     = exitMin - nowMin

        if (diff < 0) {
          // Ya cerró — buscar si tiene attendance AUSENTE
          const todayAtt = await prisma.teacherAttendance.findFirst({
            where: { teacherId: parseInt(teacherId), date: { gte: startOfDay(now), lte: endOfDay(now) } }
          })
          if (todayAtt?.status === 'AUSENTE') {
            res.status(400).json({
              message: `${teacher.firstName} ${teacher.lastName} ya fue marcado como AUSENTE para hoy`,
              outOfWindow: true
            }); return
          }
          res.status(400).json({ message: 'El turno ya finalizó. No se puede registrar entrada.', outOfWindow: true }); return
        }

        if (diff > 30) {
          res.status(400).json({
            message: `Solo se puede registrar entrada 30 minutos antes del cierre (${schedule.exitTime}). Faltan ${diff} minutos.`,
            outOfWindow: true,
            minutesBeforeExit: diff
          }); return
        }
      }
    }

    const record = await prisma.gateRecord.create({
      data: {
        type:           'MAESTRO',
        action,
        method:         (method || 'MANUAL') as any,
        teacherId:      parseInt(teacherId),
        registeredById: req.userId,
        note:           note || null,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, attendanceCode: true } }
      }
    })

    // Si es ENTRADA → actualizar TeacherAttendance
    if (action === 'ENTRADA') {
      const now   = new Date()
      const today = startOfDay(now)

      const schedule = await prisma.schoolSchedule.findFirst({ where: { isActive: true } })
      const startMin = schedule ? parseTime(schedule.startTime) : 8 * 60
      const nowMin   = now.getHours() * 60 + now.getMinutes()
      const tolerance = teacher.toleranceMin ?? 10
      const isRetraso = nowMin > startMin + tolerance

      const existing = await prisma.teacherAttendance.findFirst({
        where: { teacherId: parseInt(teacherId), date: { gte: today, lte: endOfDay(now) } }
      })

      if (existing) {
        await prisma.teacherAttendance.update({
          where: { id: existing.id },
          data:  { checkIn: now, status: isRetraso ? 'RETRASO' : 'PRESENTE' }
        })
      } else {
        await prisma.teacherAttendance.create({
          data: { teacherId: parseInt(teacherId), date: now, checkIn: now, status: isRetraso ? 'RETRASO' : 'PRESENTE' }
        })
      }
    }

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
// POST /api/gate/staff
// Registrar entrada/salida de personal administrativo
// Body: { staffId, action, method?, note? }
// ─────────────────────────────────────────────
export const registerStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId, action, method, note } = req.body

    if (!staffId || !action) {
      res.status(400).json({ message: 'staffId y action son requeridos' }); return
    }
    if (!['ENTRADA', 'SALIDA'].includes(action)) {
      res.status(400).json({ message: 'action debe ser ENTRADA o SALIDA' }); return
    }

    const staff = await prisma.staff.findUnique({ where: { id: parseInt(staffId) } })
    if (!staff) { res.status(404).json({ message: 'Personal no encontrado' }); return }

    const record = await prisma.gateRecord.create({
      data: {
        type:           'ADMINISTRATIVO',
        action,
        method:         (method || 'MANUAL') as any,
        staffId:        parseInt(staffId),
        registeredById: req.userId,
        note:           note || null,
      },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true, staffRole: true } }
      }
    })

    res.status(201).json({
      message: `${action} de ${staff.lastName} ${staff.firstName} registrada`,
      record
    })
  } catch (error) {
    console.error('registerStaff error:', error)
    res.status(500).json({ message: 'Error al registrar personal' })
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
        type:           'VISITANTE',
        action,
        method:         'MANUAL',
        visitorName,
        visitorCI:      visitorCI   || null,
        reason:         reason      || null,
        destination:    destination || null,
        registeredById: req.userId,
        note:           note        || null,
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
// POST /api/gate/mark-absent
// Marcar AUSENTE a maestros sin entrada hoy
// Solo ejecutar al cerrar el turno
// ─────────────────────────────────────────────
export const markAbsentTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now      = new Date()
    const todayDow = now.getDay()
    const today    = startOfDay(now)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    // Maestros con períodos hoy
    const schedulesToday = await prisma.schedule.findMany({
      where: {
        dayOfWeek: todayDow,
        status:    { in: ['BORRADOR', 'PUBLICADO'] },
      },
      select: { teacherSubjectCourse: { select: { teacherId: true } } }
    })

    const teacherIds = [...new Set(
      schedulesToday
        .map(s => s.teacherSubjectCourse?.teacherId)
        .filter(Boolean) as number[]
    )]

    // Los que ya tienen GateRecord ENTRADA hoy
    const withEntry = await prisma.gateRecord.findMany({
      where: { teacherId: { in: teacherIds }, type: 'MAESTRO', action: 'ENTRADA', createdAt: { gte: today, lt: tomorrow } },
      select: { teacherId: true }
    })
    const withEntryIds = new Set(withEntry.map(r => r.teacherId))

    // Los que no entraron → marcar AUSENTE en TeacherAttendance
    const absentIds = teacherIds.filter(id => !withEntryIds.has(id))

    let count = 0
    for (const teacherId of absentIds) {
      const existing = await prisma.teacherAttendance.findFirst({
        where: { teacherId, date: { gte: today, lte: endOfDay(now) } }
      })
      if (!existing) {
        await prisma.teacherAttendance.create({
          data: { teacherId, date: now, status: 'AUSENTE' }
        })
        count++
      } else if (existing.status !== 'AUSENTE' && !existing.checkIn) {
        await prisma.teacherAttendance.update({
          where: { id: existing.id },
          data:  { status: 'AUSENTE' }
        })
        count++
      }
    }

    res.json({ message: `${count} maestros marcados como AUSENTE`, count })
  } catch (error) {
    console.error('markAbsentTeachers error:', error)
    res.status(500).json({ message: 'Error al marcar ausentes' })
  }
}

// ─────────────────────────────────────────────
// GET /api/gate/records
// Listar registros del día
// Query: date, type, action
// ─────────────────────────────────────────────
export const getRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, type, action } = req.query

    const base = date ? new Date(date as string) : new Date()
    base.setHours(0, 0, 0, 0)
    const next = new Date(base); next.setDate(next.getDate() + 1)

    const records = await prisma.gateRecord.findMany({
      where: {
        createdAt: { gte: base, lt: next },
        ...(type   ? { type:   type   as any } : {}),
        ...(action ? { action: action as any } : {}),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        staff:   { select: { id: true, firstName: true, lastName: true, staffRole: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    const summary = {
      total:           records.length,
      maestros:        records.filter(r => r.type === 'MAESTRO').length,
      administrativos: records.filter(r => r.type === 'ADMINISTRATIVO').length,
      visitantes:      records.filter(r => r.type === 'VISITANTE').length,
      entradas:        records.filter(r => r.action === 'ENTRADA').length,
      salidas:         records.filter(r => r.action === 'SALIDA').length,
    }

    res.json({ records, summary })
  } catch (error) {
    console.error('getRecords error:', error)
    res.status(500).json({ message: 'Error al obtener registros' })
  }
}

// ─────────────────────────────────────────────
// GET /api/gate/records/today-teachers
// Maestros con entrada hoy (compatibilidad)
// ─────────────────────────────────────────────
export const getTodayTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today    = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const records = await prisma.gateRecord.findMany({
      where: { type: 'MAESTRO', createdAt: { gte: today, lt: tomorrow } },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const byTeacher: Record<number, any> = {}
    for (const r of records) {
      if (r.teacherId && !byTeacher[r.teacherId]) byTeacher[r.teacherId] = r
    }

    res.json(Object.values(byTeacher))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener maestros del día' })
  }
}
// ─────────────────────────────────────────────
// POST /api/gate/generate-codes
// Genera attendanceCode a maestros y staff sin código
// Formato: iniciales-NNNN (ej: JCF-4827)
// ─────────────────────────────────────────────
export const generateAttendanceCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    function makeCode(firstName: string, lastName: string): string {
      const parts = [...firstName.trim().split(' '), ...lastName.trim().split(' ')]
      const initials = parts
        .filter(p => p.length > 0)
        .slice(0, 3)
        .map(p => p[0].toUpperCase())
        .join('')
      const nums = Math.floor(1000 + Math.random() * 9000)
      return `${initials}-${nums}`
    }

    // Maestros sin código
    const teachers = await prisma.teacher.findMany({
      where: { attendanceCode: null, isActive: true },
      select: { id: true, firstName: true, lastName: true }
    })

    let teacherCount = 0
    for (const t of teachers) {
      let code = makeCode(t.firstName, t.lastName)
      // Asegurar unicidad
      let exists = await prisma.teacher.findUnique({ where: { attendanceCode: code } })
      while (exists) {
        code = makeCode(t.firstName, t.lastName)
        exists = await prisma.teacher.findUnique({ where: { attendanceCode: code } })
      }
      await prisma.teacher.update({ where: { id: t.id }, data: { attendanceCode: code } })
      teacherCount++
    }

    // Staff sin código
    const staffList = await prisma.staff.findMany({
      where: { attendanceCode: null, isActive: true },
      select: { id: true, firstName: true, lastName: true }
    })

    let staffCount = 0
    for (const s of staffList) {
      let code = makeCode(s.firstName, s.lastName)
      let exists = await prisma.staff.findUnique({ where: { attendanceCode: code } })
      while (exists) {
        code = makeCode(s.firstName, s.lastName)
        exists = await prisma.staff.findUnique({ where: { attendanceCode: code } })
      }
      await prisma.staff.update({ where: { id: s.id }, data: { attendanceCode: code } })
      staffCount++
    }

    res.json({
      message: `Códigos generados: ${teacherCount} maestros, ${staffCount} personal`,
      teacherCount,
      staffCount
    })
  } catch (error) {
    console.error('generateAttendanceCodes error:', error)
    res.status(500).json({ message: 'Error al generar códigos' })
  }
}
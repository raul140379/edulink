import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/treasury/charges — Listar cargos
// ─────────────────────────────────────────────
export const getCharges = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, type, parentId, academicYearId } = req.query

    const charges = await prisma.charge.findMany({
      where: {
        ...(status        ? { status:        status        as any } : {}),
        ...(type          ? { type:          type          as any } : {}),
        ...(parentId      ? { parentId:      parseInt(parentId as string) } : {}),
        ...(academicYearId ? { academicYearId: parseInt(academicYearId as string) } : {}),
      },
      include: {
        parent:      { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } },
        student:     { select: { id: true, firstName: true, lastName: true, ci: true } },
        academicYear: { select: { id: true, year: true } },
        payments:    { orderBy: { date: 'desc' } },
        _count:      { select: { payments: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(charges)
  } catch (error) {
    console.error('getCharges error:', error)
    res.status(500).json({ message: 'Error al obtener cargos' })
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/charges/:id
// ─────────────────────────────────────────────
export const getChargeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const charge = await prisma.charge.findUnique({
      where: { id: parseInt(id) },
      include: {
        parent:      { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } },
        student:     { select: { id: true, firstName: true, lastName: true, ci: true } },
        academicYear: { select: { id: true, year: true } },
        payments:    { orderBy: { date: 'desc' } },
      }
    })

    if (!charge) {
      res.status(404).json({ message: 'Cargo no encontrado' })
      return
    }

    res.json(charge)
  } catch (error) {
    console.error('getChargeById error:', error)
    res.status(500).json({ message: 'Error al obtener cargo' })
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/parents/:parentId/account
// Estado de cuenta completo de un tutor
// ─────────────────────────────────────────────
export const getParentAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { parentId } = req.params

    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(parentId) },
      select: { id: true, firstName: true, lastName: true, ci: true, phone: true,
        students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } }
      }
    })

    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    const charges = await prisma.charge.findMany({
      where: { parentId: parseInt(parentId) },
      include: {
        student:     { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { year: true } },
        payments:    { orderBy: { date: 'desc' } },
      },
      orderBy: { createdAt: 'desc' }
    })

    const totalDebt    = charges.reduce((sum, c) => sum + c.amount, 0)
    const totalPaid    = charges.reduce((sum, c) => sum + c.paidAmount, 0)
    const totalPending = totalDebt - totalPaid

    res.json({ parent, charges, summary: { totalDebt, totalPaid, totalPending } })
  } catch (error) {
    console.error('getParentAccount error:', error)
    res.status(500).json({ message: 'Error al obtener estado de cuenta' })
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/charges — Crear cargo
// ─────────────────────────────────────────────
export const createCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, amount, type, target, dueDate,
            parentId, studentId, academicYearId, tolerance, toleranceNote } = req.body

    if (!title || !amount || !type || !parentId || !academicYearId) {
      res.status(400).json({ message: 'Título, monto, tipo, tutor y gestión son requeridos' })
      return
    }

    // Verificar que el tutor existe
    const parent = await prisma.parent.findUnique({ where: { id: parseInt(parentId) } })
    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    // Si el cargo es por estudiante, verificar que el estudiante existe
    if (target === 'ESTUDIANTE' && studentId) {
      const student = await prisma.student.findUnique({ where: { id: parseInt(studentId) } })
      if (!student) {
        res.status(404).json({ message: 'Estudiante no encontrado' })
        return
      }
    }

    const charge = await prisma.charge.create({
      data: {
        title,
        description:   description   || null,
        amount:        parseFloat(amount),
        type,
        target:        target        || 'TUTOR',
        dueDate:       dueDate       ? new Date(dueDate) : null,
        tolerance:     tolerance     || false,
        toleranceNote: toleranceNote || null,
        parentId:      parseInt(parentId),
        studentId:     (target === 'ESTUDIANTE' && studentId) ? parseInt(studentId) : null,
        academicYearId: parseInt(academicYearId),
      },
      include: {
        parent:      { select: { id: true, firstName: true, lastName: true } },
        student:     { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { year: true } },
      }
    })

    res.status(201).json({ message: 'Cargo registrado correctamente', charge })
  } catch (error) {
    console.error('createCharge error:', error)
    res.status(500).json({ message: 'Error al registrar cargo' })
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/charges/bulk — Crear cargos masivos
// Para cuota inicial, minga, multa asamblea — a todos los tutores
// ─────────────────────────────────────────────
export const createBulkCharges = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, amount, type, dueDate, academicYearId, parentIds } = req.body

    if (!title || !amount || !type || !academicYearId || !parentIds || parentIds.length === 0) {
      res.status(400).json({ message: 'Datos incompletos para cargos masivos' })
      return
    }

    const created = []
    const errors  = []

    for (const parentId of parentIds) {
      try {
        const charge = await prisma.charge.create({
          data: {
            title,
            description: description || null,
            amount:      parseFloat(amount),
            type,
            target:      'TUTOR',
            dueDate:     dueDate ? new Date(dueDate) : null,
            parentId:    parseInt(parentId),
            academicYearId: parseInt(academicYearId),
          }
        })
        created.push(charge)
      } catch (e) {
        errors.push(parentId)
      }
    }

    res.status(201).json({
      message:  `${created.length} cargos creados correctamente`,
      created:  created.length,
      errors:   errors.length,
    })
  } catch (error) {
    console.error('createBulkCharges error:', error)
    res.status(500).json({ message: 'Error al crear cargos masivos' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/treasury/charges/:id — Actualizar cargo
// ─────────────────────────────────────────────
export const updateCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { title, description, amount, dueDate, tolerance, toleranceNote } = req.body

    const existing = await prisma.charge.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Cargo no encontrado' })
      return
    }

    if (existing.status === 'PAGADO') {
      res.status(400).json({ message: 'No se puede modificar un cargo ya pagado' })
      return
    }

    const charge = await prisma.charge.update({
      where: { id: parseInt(id) },
      data: {
        ...(title        !== undefined ? { title }                            : {}),
        ...(description  !== undefined ? { description: description || null } : {}),
        ...(amount       !== undefined ? { amount: parseFloat(amount) }       : {}),
        ...(dueDate      !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(tolerance    !== undefined ? { tolerance }                        : {}),
        ...(toleranceNote !== undefined ? { toleranceNote: toleranceNote || null } : {}),
      },
      include: {
        parent:  { select: { id: true, firstName: true, lastName: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      }
    })

    res.json({ message: 'Cargo actualizado correctamente', charge })
  } catch (error) {
    console.error('updateCharge error:', error)
    res.status(500).json({ message: 'Error al actualizar cargo' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/treasury/charges/:id/cancel — Anular cargo
// ─────────────────────────────────────────────
export const cancelCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const existing = await prisma.charge.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Cargo no encontrado' })
      return
    }

    if (existing.status === 'PAGADO') {
      res.status(400).json({ message: 'No se puede anular un cargo ya pagado' })
      return
    }

    await prisma.charge.update({
      where: { id: parseInt(id) },
      data:  { status: 'ANULADO' }
    })

    res.json({ message: 'Cargo anulado correctamente' })
  } catch (error) {
    console.error('cancelCharge error:', error)
    res.status(500).json({ message: 'Error al anular cargo' })
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/charges/:id/payments — Registrar pago
// ─────────────────────────────────────────────
export const registerPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { amount, method, reference, note, date } = req.body

    if (!amount || !method) {
      res.status(400).json({ message: 'Monto y método de pago son requeridos' })
      return
    }

    const charge = await prisma.charge.findUnique({
      where: { id: parseInt(id) },
      include: { payments: true }
    })

    if (!charge) {
      res.status(404).json({ message: 'Cargo no encontrado' })
      return
    }

    if (charge.status === 'ANULADO') {
      res.status(400).json({ message: 'No se puede registrar pago en un cargo anulado' })
      return
    }

    if (charge.status === 'PAGADO') {
      res.status(400).json({ message: 'Este cargo ya está completamente pagado' })
      return
    }

    const paymentAmount = parseFloat(amount)
    const remaining     = charge.amount - charge.paidAmount

    if (paymentAmount > remaining) {
      res.status(400).json({ message: `El monto excede el saldo pendiente de Bs. ${remaining.toFixed(2)}` })
      return
    }

    const newPaidAmount = charge.paidAmount + paymentAmount
    const newStatus     = newPaidAmount >= charge.amount ? 'PAGADO' : 'PARCIAL'

    // Crear pago y actualizar cargo
    const payment = await prisma.payment.create({
      data: {
        amount:    paymentAmount,
        method:    method as any,
        reference: reference || null,
        note:      note      || null,
        date:      date ? new Date(date) : new Date(),
        chargeId:  parseInt(id),
        parentId:  charge.parentId,
      }
    })

    await prisma.charge.update({
      where: { id: parseInt(id) },
      data:  { paidAmount: newPaidAmount, status: newStatus as any }
    })

    res.status(201).json({
      message:    `Pago de Bs. ${paymentAmount.toFixed(2)} registrado correctamente`,
      payment,
      newStatus,
      paidAmount: newPaidAmount,
      remaining:  charge.amount - newPaidAmount,
    })
  } catch (error) {
    console.error('registerPayment error:', error)
    res.status(500).json({ message: 'Error al registrar pago' })
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/summary — Resumen general
// ─────────────────────────────────────────────
export const getTreasurySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId } = req.query

    const where = academicYearId ? { academicYearId: parseInt(academicYearId as string) } : {}

    const charges = await prisma.charge.findMany({
      where: { ...where, status: { not: 'ANULADO' } },
      select: { amount: true, paidAmount: true, status: true, type: true }
    })

    const totalCharged  = charges.reduce((sum, c) => sum + c.amount, 0)
    const totalCollected = charges.reduce((sum, c) => sum + c.paidAmount, 0)
    const totalPending  = totalCharged - totalCollected

    const byStatus = {
      PENDIENTE: charges.filter(c => c.status === 'PENDIENTE').length,
      PARCIAL:   charges.filter(c => c.status === 'PARCIAL').length,
      PAGADO:    charges.filter(c => c.status === 'PAGADO').length,
    }

    const byType = charges.reduce((acc: any, c) => {
      if (!acc[c.type]) acc[c.type] = { count: 0, amount: 0, collected: 0 }
      acc[c.type].count++
      acc[c.type].amount    += c.amount
      acc[c.type].collected += c.paidAmount
      return acc
    }, {})

    res.json({ totalCharged, totalCollected, totalPending, byStatus, byType })
  } catch (error) {
    console.error('getTreasurySummary error:', error)
    res.status(500).json({ message: 'Error al obtener resumen' })
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/parents — Listar tutores con estado de cuenta
// ─────────────────────────────────────────────
export const getParentsWithBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId, search, status } = req.query

    const parents = await prisma.parent.findMany({
      where: {
        ...(search ? {
          OR: [
            { firstName: { contains: search as string, mode: 'insensitive' } },
            { lastName:  { contains: search as string, mode: 'insensitive' } },
            { ci:        { contains: search as string, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: {
        students: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } }
        },
        charges: {
          where: {
            status: { not: 'ANULADO' },
            ...(academicYearId ? { academicYearId: parseInt(academicYearId as string) } : {}),
          },
          select: { amount: true, paidAmount: true, status: true }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })

    const result = parents.map(p => {
      const totalDebt    = p.charges.reduce((sum, c) => sum + c.amount, 0)
      const totalPaid    = p.charges.reduce((sum, c) => sum + c.paidAmount, 0)
      const totalPending = totalDebt - totalPaid
      const hasDebt      = totalPending > 0

      return {
        id:        p.id,
        firstName: p.firstName,
        lastName:  p.lastName,
        ci:        p.ci,
        phone:     p.phone,
        students:  p.students,
        summary: { totalDebt, totalPaid, totalPending, hasDebt, chargesCount: p.charges.length }
      }
    })

    // Filtrar por estado de deuda si se solicita
    const filtered = status === 'CON_DEUDA'
      ? result.filter(p => p.summary.hasDebt)
      : status === 'AL_DIA'
      ? result.filter(p => !p.summary.hasDebt)
      : result

    res.json(filtered)
  } catch (error) {
    console.error('getParentsWithBalance error:', error)
    res.status(500).json({ message: 'Error al obtener tutores' })
  }
}
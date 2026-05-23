import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/reports/teachers — Reporte de maestros
// ─────────────────────────────────────────────
export const getTeachersReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      include: {
        user: { select: { email: true, isActive: true } },
        assignments: {
          include: {
            subject: { select: { name: true, code: true } },
            course:  { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
          }
        },
        tutorCourse: {
          include: {
            course: { select: { id: true, level: true, grade: true, parallel: true, shift: true } }
          }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })

    res.json(teachers)
  } catch (error) {
    console.error('getTeachersReport error:', error)
    res.status(500).json({ message: 'Error al obtener reporte de maestros' })
  }
}

// ─────────────────────────────────────────────
// GET /api/reports/delegates — Reporte de delegados
// ─────────────────────────────────────────────
export const getDelegatesReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        delegate: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, phone: true,
            user: { select: { email: true } },
            students: {
              where: { isTutor: true },
              include: {
                student: { select: { firstName: true, lastName: true } }
              },
              take: 1
            }
          }
        },
        tutor: {
          include: {
            teacher: { select: { firstName: true, lastName: true } }
          }
        },
        _count: { select: { assignments: true } }
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }]
    })

    res.json(courses)
  } catch (error) {
    console.error('getDelegatesReport error:', error)
    res.status(500).json({ message: 'Error al obtener reporte de delegados' })
  }
}

// ─────────────────────────────────────────────
// GET /api/reports/treasury — Reporte económico
// ─────────────────────────────────────────────
export const getTreasuryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId } = req.query

    const activeYear = academicYearId
      ? await prisma.academicYear.findUnique({ where: { id: parseInt(academicYearId as string) } })
      : await prisma.academicYear.findFirst({ where: { isActive: true } })

    if (!activeYear) {
      res.status(404).json({ message: 'No hay gestión académica activa' })
      return
    }

    const charges = await prisma.charge.findMany({
      where: { academicYearId: activeYear.id, status: { not: 'ANULADO' } },
      include: {
        parent: { select: { firstName: true, lastName: true, ci: true } },
        student: { select: { firstName: true, lastName: true } },
      }
    })

    // Resumen general
    const totalCharged   = charges.reduce((s, c) => s + c.amount, 0)
    const totalCollected = charges.reduce((s, c) => s + c.paidAmount, 0)
    const totalPending   = totalCharged - totalCollected

    // Por tipo
    const byType = charges.reduce((acc, c) => {
      if (!acc[c.type]) acc[c.type] = { count: 0, charged: 0, collected: 0 }
      acc[c.type].count++
      acc[c.type].charged   += c.amount
      acc[c.type].collected += c.paidAmount
      return acc
    }, {} as Record<string, { count: number; charged: number; collected: number }>)

    // Por estado
    const byStatus = charges.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Tutores morosos
    const morosos = await prisma.parent.findMany({
      where: {
        charges: {
          some: {
            academicYearId: activeYear.id,
            status: { in: ['PENDIENTE', 'PARCIAL'] }
          }
        }
      },
      include: {
        charges: {
          where: {
            academicYearId: activeYear.id,
            status: { in: ['PENDIENTE', 'PARCIAL'] }
          },
          select: { amount: true, paidAmount: true, status: true, type: true }
        },
        students: {
          where: { isTutor: true },
          include: {
            student: { select: { firstName: true, lastName: true } }
          },
          take: 1
        }
      },
      orderBy: [{ lastName: 'asc' }]
    })

    res.json({
      academicYear: activeYear,
      summary: { totalCharged, totalCollected, totalPending },
      byType,
      byStatus,
      morosos: morosos.map(p => ({
        id:        p.id,
        firstName: p.firstName,
        lastName:  p.lastName,
        ci:        p.ci,
        phone:     p.phone,
        student:   p.students[0]?.student,
        pending:   p.charges.reduce((s, c) => s + (c.amount - c.paidAmount), 0),
        charges:   p.charges.length,
      }))
    })
  } catch (error) {
    console.error('getTreasuryReport error:', error)
    res.status(500).json({ message: 'Error al obtener reporte económico' })
  }
}
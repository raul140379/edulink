import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/meetings/my-course — Reuniones del curso del delegado
// ─────────────────────────────────────────────
export const getMyMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { delegateCourse: true }
    })

    if (!parent || !parent.delegateCourse) {
      res.status(404).json({ message: 'No tienes un curso asignado como delegado' })
      return
    }

    const meetings = await prisma.meeting.findMany({
      where: { courseId: parent.delegateCourse.id },
      include: {
        attendances: {
          include: {
            parent: { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } }
          }
        },
        createdBy: { select: { id: true, email: true } }
      },
      orderBy: { date: 'desc' }
    })

    res.json(meetings)
  } catch (error) {
    console.error('getMyMeetings error:', error)
    res.status(500).json({ message: 'Error al obtener reuniones' })
  }
}

// ─────────────────────────────────────────────
// POST /api/meetings — Crear reunión
// ─────────────────────────────────────────────
export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    const { title, date } = req.body

    if (!title || !date) {
      res.status(400).json({ message: 'Título y fecha son requeridos' })
      return
    }

    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: {
        delegateCourse: {
          include: {
            assignments: {
              where: { academicYear: { isActive: true } },
              include: {
                student: {
                  include: {
                    parents: {
                      where: { isTutor: true },
                      include: {
                        parent: { select: { id: true, firstName: true, lastName: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!parent || !parent.delegateCourse) {
      res.status(404).json({ message: 'No tienes un curso asignado como delegado' })
      return
    }

    // Obtener tutores legales únicos del curso
    const tutorIds = new Set<number>()
    for (const a of parent.delegateCourse.assignments) {
      for (const ps of a.student.parents) {
        tutorIds.add(ps.parent.id)
      }
    }

    // Crear reunión con asistencias iniciales (todos ausentes)
    const meeting = await prisma.meeting.create({
      data: {
        title,
        date:        new Date(date),
        courseId:    parent.delegateCourse.id,
        createdById: userId!,
        attendances: {
          create: Array.from(tutorIds).map(parentId => ({
            parentId,
            present: false,
          }))
        }
      },
      include: {
        attendances: {
          include: {
            parent: { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } }
          }
        }
      }
    })

    res.status(201).json({ message: 'Reunión creada correctamente', meeting })
  } catch (error) {
    console.error('createMeeting error:', error)
    res.status(500).json({ message: 'Error al crear reunión' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/meetings/:id/attendance — Actualizar asistencia
// ─────────────────────────────────────────────
export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { attendances } = req.body // [{ parentId, present, note }]

    if (!attendances || !Array.isArray(attendances)) {
      res.status(400).json({ message: 'Datos de asistencia requeridos' })
      return
    }

    // Actualizar cada asistencia
    await Promise.all(
      attendances.map((a: { parentId: number; present: boolean; note?: string }) =>
        prisma.attendance.updateMany({
          where: { meetingId: parseInt(id), parentId: a.parentId },
          data:  { present: a.present, note: a.note || null }
        })
      )
    )

    res.json({ message: 'Asistencia actualizada correctamente' })
  } catch (error) {
    console.error('updateAttendance error:', error)
    res.status(500).json({ message: 'Error al actualizar asistencia' })
  }
}

// ─────────────────────────────────────────────
// POST /api/meetings/:id/charge-absences — Multar ausentes
// ─────────────────────────────────────────────
export const chargeAbsences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { amount, academicYearId } = req.body

    if (!amount || !academicYearId) {
      res.status(400).json({ message: 'Monto y gestión son requeridos' })
      return
    }

    const meeting = await prisma.meeting.findUnique({
      where:   { id: parseInt(id) },
      include: {
        attendances: {
          where:   { present: false },
          include: { parent: true }
        }
      }
    })

    if (!meeting) {
      res.status(404).json({ message: 'Reunión no encontrada' })
      return
    }

    const absentes = meeting.attendances

    if (absentes.length === 0) {
      res.json({ message: 'No hay ausentes en esta reunión', charged: 0 })
      return
    }

    // Crear cargo para cada ausente
    await Promise.all(
      absentes.map(a =>
        prisma.charge.create({
          data: {
            title:          `Multa reunión: ${meeting.title}`,
            description:    `Ausente en reunión del ${new Date(meeting.date).toLocaleDateString('es-BO')}`,
            amount:         parseFloat(amount),
            paidAmount:     0,
            type:           'MULTA_REUNION',
            target:         'TUTOR',
            status:         'PENDIENTE',
            parentId:       a.parentId,
            academicYearId: parseInt(academicYearId),
          }
        })
      )
    )

    res.json({
      message: `Multa creada para ${absentes.length} ausentes`,
      charged: absentes.length,
    })
  } catch (error) {
    console.error('chargeAbsences error:', error)
    res.status(500).json({ message: 'Error al crear multas' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/meetings/:id — Eliminar reunión
// ─────────────────────────────────────────────
export const deleteMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    await prisma.attendance.deleteMany({ where: { meetingId: parseInt(id) } })
    await prisma.meeting.delete({ where: { id: parseInt(id) } })

    res.json({ message: 'Reunión eliminada correctamente' })
  } catch (error) {
    console.error('deleteMeeting error:', error)
    res.status(500).json({ message: 'Error al eliminar reunión' })
  }
}
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// GET /api/teachers/:id/specialties
export const getTeacherSpecialties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = parseInt(req.params.id)

    const specialties = await prisma.teacherSpecialty.findMany({
      where: { teacherId },
      include: {
        subject: {
          select: { id: true, name: true, campo: true, level: true }
        }
      },
      orderBy: { subject: { name: 'asc' } }
    })

    res.json(specialties)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error al obtener especialidades' })
  }
}

// POST /api/teachers/:id/specialties — asignar especialidad
export const addTeacherSpecialty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = parseInt(req.params.id)
    const { subjectId } = req.body

    if (!subjectId) {
      res.status(400).json({ message: 'subjectId es requerido' })
      return
    }

    const specialty = await prisma.teacherSpecialty.create({
      data: { teacherId, subjectId: parseInt(subjectId) },
      include: {
        subject: { select: { id: true, name: true, campo: true } }
      }
    })

    res.status(201).json({ message: 'Especialidad asignada', specialty })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'El maestro ya tiene esa especialidad' })
      return
    }
    console.error(error)
    res.status(500).json({ message: 'Error al asignar especialidad' })
  }
}

// DELETE /api/teachers/:id/specialties/:specialtyId — quitar especialidad
export const removeTeacherSpecialty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const specialtyId = parseInt(req.params.specialtyId)
    await prisma.teacherSpecialty.delete({ where: { id: specialtyId } })
    res.json({ message: 'Especialidad removida' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error al remover especialidad' })
  }
}
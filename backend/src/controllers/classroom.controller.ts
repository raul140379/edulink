import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/classrooms
// Listar aulas
// ─────────────────────────────────────────────
export const getClassrooms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classrooms = await prisma.classroom.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
    res.json(classrooms)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener aulas' })
  }
}

// ─────────────────────────────────────────────
// POST /api/classrooms
// Crear aula
// ─────────────────────────────────────────────
export const createClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, capacity } = req.body
    if (!name) { res.status(400).json({ message: 'El nombre del aula es requerido' }); return }

    const classroom = await prisma.classroom.create({
      data: { name, capacity: capacity || null }
    })
    res.status(201).json({ message: 'Aula creada correctamente', classroom })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Ya existe un aula con ese nombre' }); return
    }
    res.status(500).json({ message: 'Error al crear aula' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/classrooms/:id
// Actualizar aula
// ─────────────────────────────────────────────
export const updateClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, capacity, isActive } = req.body

    const classroom = await prisma.classroom.update({
      where: { id: parseInt(id) },
      data: {
        ...(name      !== undefined ? { name }      : {}),
        ...(capacity  !== undefined ? { capacity }  : {}),
        ...(isActive  !== undefined ? { isActive }  : {}),
      }
    })
    res.json({ message: 'Aula actualizada', classroom })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Ya existe un aula con ese nombre' }); return
    }
    res.status(500).json({ message: 'Error al actualizar aula' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/classrooms/:id
// Desactivar aula
// ─────────────────────────────────────────────
export const deleteClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.classroom.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    })
    res.json({ message: 'Aula desactivada correctamente' })
  } catch (error) {
    res.status(500).json({ message: 'Error al desactivar aula' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/schedules/:id/classroom
// Asignar aula a un periodo del horario
// ─────────────────────────────────────────────
export const assignClassroomToPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { classroomId } = req.body

    const schedule = await prisma.schedule.update({
      where: { id: parseInt(id) },
      data: { classroomId: classroomId ? parseInt(classroomId) : null },
      include: {
        classroom: true,
        teacherSubjectCourse: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          }
        }
      }
    })
    res.json({ message: 'Aula asignada correctamente', schedule })
  } catch (error) {
    res.status(500).json({ message: 'Error al asignar aula' })
  }
}
// ─────────────────────────────────────────────
// PATCH /api/classrooms/course/:courseId/all
// Asignar un aula a todos los periodos de un curso
// ─────────────────────────────────────────────
export const assignClassroomToCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { classroomId } = req.body

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) { res.status(400).json({ message: 'No hay gestión activa' }); return }

    const updated = await prisma.schedule.updateMany({
      where: {
        courseId:       parseInt(courseId),
        academicYearId: activeYear.id,
        //status:         'BORRADOR',
      },
      data: { classroomId: classroomId ? parseInt(classroomId) : null }
    })

    res.json({ message: `Aula asignada a ${updated.count} periodos`, count: updated.count })
  } catch (error) {
    res.status(500).json({ message: 'Error al asignar aula al curso' })
  }
}
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { classroomService } from '../services/classroom.service'

// ─────────────────────────────────────────────
// GET /api/classrooms
// ─────────────────────────────────────────────
export const getClassrooms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await classroomService.getClassrooms())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/classrooms
// ─────────────────────────────────────────────
export const createClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classroom = await classroomService.createClassroom(req.body)
    res.status(201).json({ message: 'Aula creada correctamente', classroom })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/classrooms/:id
// ─────────────────────────────────────────────
export const updateClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classroom = await classroomService.updateClassroom(parseInt(req.params.id), req.body)
    res.json({ message: 'Aula actualizada', classroom })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/classrooms/:id
// ─────────────────────────────────────────────
export const deleteClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await classroomService.deleteClassroom(parseInt(req.params.id))
    res.json({ message: 'Aula desactivada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/classrooms/:id/classroom
// ─────────────────────────────────────────────
export const assignClassroomToPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedule = await classroomService.assignClassroomToPeriod(parseInt(req.params.id), req.body)
    res.json({ message: 'Aula asignada correctamente', schedule })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/classrooms/course/:courseId/all
// ─────────────────────────────────────────────
export const assignClassroomToCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await classroomService.assignClassroomToCourse(parseInt(req.params.courseId), req.body)
    res.json({ message: `Aula asignada a ${count} periodos`, count })
  } catch (error) {
    handleControllerError(res, error)
  }
}

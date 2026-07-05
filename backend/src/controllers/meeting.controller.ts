import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { meetingService } from '../services/meeting.service'

// ─────────────────────────────────────────────
// GET /api/meetings — Reuniones del curso del delegado
// ─────────────────────────────────────────────
export const getMyMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await meetingService.getMyMeetings(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/meetings — Crear reunión (delegado)
// ─────────────────────────────────────────────
export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await meetingService.createMeeting(req.userId, req.body)
    res.status(201).json({ message: 'Reunión creada correctamente', meeting })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/meetings/:id/attendance — Actualizar asistencia
// ─────────────────────────────────────────────
export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await meetingService.updateAttendance(parseInt(req.params.id), req.body)
    res.json({ message: 'Asistencia actualizada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/meetings/:id/charge-absences — Multar ausentes
// ─────────────────────────────────────────────
export const chargeAbsences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await meetingService.chargeAbsences(parseInt(req.params.id), req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/meetings/:id — Eliminar reunión
// ─────────────────────────────────────────────
export const deleteMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await meetingService.deleteMeeting(parseInt(req.params.id))
    res.json({ message: 'Reunión eliminada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/meetings/my-course — Reuniones del curso del maestro tutor
// ─────────────────────────────────────────────
export const getMyMeetingsAsTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await meetingService.getMyMeetingsAsTutor(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/meetings/my-course — Crear reunión como maestro tutor
// ─────────────────────────────────────────────
export const createMeetingAsTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await meetingService.createMeetingAsTutor(req.userId, req.body)
    res.status(201).json({ message: 'Reunión creada correctamente', meeting })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/meetings/:id — Actualizar reunión
// ─────────────────────────────────────────────
export const updateMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await meetingService.updateMeeting(parseInt(req.params.id), req.body)
    res.json({ message: 'Reunión actualizada correctamente', meeting })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/meetings/by-course?courseId= — Reuniones de un curso (maestro)
// ─────────────────────────────────────────────
export const getMeetingsByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.query
    if (!courseId) { res.status(400).json({ message: 'courseId es requerido' }); return }
    res.json(await meetingService.getMeetingsByCourse(parseInt(courseId as string)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/meetings/by-teacher — Crear reunión como maestro de materia
// ─────────────────────────────────────────────
export const createMeetingAsTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await meetingService.createMeetingAsTeacher(req.userId, req.body)
    res.status(201).json({ message: 'Reunión creada correctamente', meeting })
  } catch (error) {
    handleControllerError(res, error)
  }
}

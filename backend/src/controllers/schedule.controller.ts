import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { scheduleService } from '../services/schedule.service'

// ─────────────────────────────────────────────
// GET /api/schedules/school-schedules
// ─────────────────────────────────────────────
export const getSchoolSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getSchoolSchedules())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/school-schedules
// ─────────────────────────────────────────────
export const createSchoolSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedule = await scheduleService.createSchoolSchedule(req.body)
    res.status(201).json({ message: 'Configuración creada correctamente', schedule })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/schedules/school-schedules/:id
// ─────────────────────────────────────────────
export const updateSchoolSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedule = await scheduleService.updateSchoolSchedule(parseInt(req.params.id), req.body)
    res.json({ message: 'Configuración actualizada', schedule })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/periodos/:schoolScheduleId
// ─────────────────────────────────────────────
export const getPeriodos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getPeriodos(parseInt(req.params.schoolScheduleId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/course/:courseId
// ─────────────────────────────────────────────
export const getCourseSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getCourseSchedule(parseInt(req.params.courseId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/course/:courseId/period
// ─────────────────────────────────────────────
export const assignPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedule = await scheduleService.assignPeriod(parseInt(req.params.courseId), req.body)
    res.json({ message: 'Periodo asignado correctamente', schedule })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/schedules/:id
// ─────────────────────────────────────────────
export const deletePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await scheduleService.deletePeriod(parseInt(req.params.id))
    res.json({ message: 'Periodo eliminado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/teacher/:teacherId
// ─────────────────────────────────────────────
export const getTeacherSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getTeacherSchedule(parseInt(req.params.teacherId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/my-schedule
// ─────────────────────────────────────────────
export const getMySchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getMySchedule(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/generate/:courseId
// ─────────────────────────────────────────────
export const generateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await scheduleService.generateSchedule(parseInt(req.params.courseId))
    res.json({ message: `Horario generado: ${result.created} periodos asignados`, ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/schedules/publish/:courseId
// ─────────────────────────────────────────────
export const publishSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await scheduleService.publishSchedule(parseInt(req.params.courseId))
    res.json({ message: `Horario publicado: ${count} periodos confirmados`, count })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/schedules/draft/:courseId
// ─────────────────────────────────────────────
export const deleteDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await scheduleService.deleteDraft(parseInt(req.params.courseId))
    res.json({ message: `Borrador eliminado: ${count} periodos`, count })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/tscs/:courseId
// ─────────────────────────────────────────────
export const getTscsByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getTscsByCourse(parseInt(req.params.courseId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/schedules/course/:courseId/all
// ─────────────────────────────────────────────
export const deleteAllSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await scheduleService.deleteAllSchedule(parseInt(req.params.courseId))
    res.json({ message: `Horario eliminado: ${count} periodos`, count })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/schedules/course/:courseId/periods-summary
// ─────────────────────────────────────────────
export const getPeriodsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await scheduleService.getPeriodsSummary(parseInt(req.params.courseId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { planificacionService } from '../services/planificacion.service'

// POST /api/planificacion/generate
export const generatePlanificacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await planificacionService.generatePlanificacion(req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/planificacion/save-slot
export const saveSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await planificacionService.saveSlot(req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/planificacion/course/:courseId
export const getPlanificacionByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const slot = (req.query.slot as string) || 'TEMP'
    const result = await planificacionService.getPlanificacionByCourse(parseInt(req.params.courseId), slot)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/planificacion/teachers
export const getPlanificacionTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const slot = (req.query.slot as string) || 'TEMP'
    const result = await planificacionService.getPlanificacionTeachers(slot)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/planificacion/slots-status
export const getSlotsStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await planificacionService.getSlotsStatus())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/planificacion/course/:courseId/period
export const assignPlanPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await planificacionService.assignPlanPeriod(parseInt(req.params.courseId), req.body)
    res.json({ message: 'Periodo asignado', plan })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// DELETE /api/planificacion/:id
export const deletePlanPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await planificacionService.deletePlanPeriod(parseInt(req.params.id))
    res.json({ message: 'Periodo eliminado' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// DELETE /api/planificacion/slot/:slot
export const clearSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await planificacionService.clearSlot(req.params.slot)
    res.json({ message: `Slot ${req.params.slot} eliminado: ${count} periodos` })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/planificacion/promote
export const promotePlanificacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await planificacionService.promotePlanificacion(req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

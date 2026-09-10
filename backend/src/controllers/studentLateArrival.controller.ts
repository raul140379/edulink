import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { studentLateArrivalService } from '../services/studentLateArrival.service'

// POST /api/student-late-arrivals
export const createLateArrival = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLateArrivalService.registerLateArrival(req.body, req.userId!)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/student-late-arrivals/:id/notify
export const notifyParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLateArrivalService.notifyParent(parseInt(req.params.id), req.userId!)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/student-late-arrivals/today/:courseId
export const getTodayForCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const list = await studentLateArrivalService.getTodayForCourse(parseInt(req.params.courseId))
    res.json(list)
  } catch (error) {
    handleControllerError(res, error)
  }
}

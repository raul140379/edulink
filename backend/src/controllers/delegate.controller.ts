import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { delegateService } from '../services/delegate.service'

// ─────────────────────────────────────────────
// GET /api/delegates — Listar cursos con su delegado
// ─────────────────────────────────────────────
export const getDelegates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await delegateService.getDelegates())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/delegates/course/:courseId/eligible-parents
// ─────────────────────────────────────────────
export const getEligibleParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await delegateService.getEligibleParents(parseInt(req.params.courseId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/delegates/course/:courseId/assign
// ─────────────────────────────────────────────
export const assignDelegate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await delegateService.assignDelegate(parseInt(req.params.courseId), req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/delegates/course/:courseId/remove
// ─────────────────────────────────────────────
export const removeDelegate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await delegateService.removeDelegate(parseInt(req.params.courseId))
    res.json({ message: 'Delegado removido correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/delegates/my-course
// ─────────────────────────────────────────────
export const getMyCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await delegateService.getMyCourse(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

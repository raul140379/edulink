import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { attendanceCheckinService } from '../services/attendance-checkin.service'

// ─────────────────────────────────────────────
// POST /api/attendance-checkin
// ─────────────────────────────────────────────
export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await attendanceCheckinService.checkIn(req.body.code)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

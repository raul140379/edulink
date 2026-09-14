import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { staffAttendanceService } from '../services/staffAttendance.service'

// ─────────────────────────────────────────────
// GET /api/staff-attendance/report
// ─────────────────────────────────────────────
export const getReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await staffAttendanceService.getReport({
      month:   req.query.month ? parseInt(req.query.month as string) : undefined,
      year:    req.query.year  ? parseInt(req.query.year  as string) : undefined,
      week:    req.query.week  ? parseInt(req.query.week  as string) : undefined,
      date:    req.query.date as string | undefined,
      staffId: req.query.staffId ? parseInt(req.query.staffId as string) : undefined,
    })
    res.json(report)
  } catch (error) {
    handleControllerError(res, error)
  }
}

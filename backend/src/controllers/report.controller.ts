import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { reportService } from '../services/report.service'

// GET /api/reports/teachers
export const getTeachersReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await reportService.getTeachersReport())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/reports/delegates
export const getDelegatesReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await reportService.getDelegatesReport())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/reports/attendance
export const getAttendanceReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await reportService.getAttendanceReport())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/reports/treasury
export const getTreasuryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId } = req.query
    const report = await reportService.getTreasuryReport(academicYearId ? parseInt(academicYearId as string) : undefined)
    res.json(report)
  } catch (error) {
    handleControllerError(res, error)
  }
}

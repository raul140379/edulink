import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { reportService } from '../services/report.service'
import { parsePagination } from '../utils/pagination'

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

// GET /api/reports/attendance-daily
export const getDailyAttendanceCompliance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await reportService.getDailyAttendanceCompliance(req.query.date as string | undefined))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/reports/attendance-daily/:courseId
export const getDailyAttendanceCourseDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await reportService.getDailyAttendanceCourseDetail(parseInt(req.params.courseId, 10), req.query.date as string | undefined)
    res.json(report)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/reports/treasury
export const getTreasuryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId, page, pageSize } = req.query
    const report = await reportService.getTreasuryReport(
      academicYearId ? parseInt(academicYearId as string) : undefined,
      parsePagination(page as string | undefined, pageSize as string | undefined)
    )
    res.json(report)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/reports/carried-debt
export const getCarriedDebtReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId } = req.query
    const report = await reportService.getCarriedDebtReport(academicYearId ? parseInt(academicYearId as string) : undefined)
    res.json(report)
  } catch (error) {
    handleControllerError(res, error)
  }
}

import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { teacherAttendanceService } from '../services/teacherAttendance.service'

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/check-in
// ─────────────────────────────────────────────
export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message, attendance, isNew } = await teacherAttendanceService.checkIn(req.userId)
    res.status(isNew ? 201 : 200).json({ message, attendance })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/check-out
// ─────────────────────────────────────────────
export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await teacherAttendanceService.checkOut(req.userId)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/my-today
// ─────────────────────────────────────────────
export const getMyToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await teacherAttendanceService.getMyToday(req.userId) || null)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/my-history
// ─────────────────────────────────────────────
export const getMyHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : undefined
    const year  = req.query.year  ? parseInt(req.query.year  as string) : undefined
    res.json(await teacherAttendanceService.getMyHistory(req.userId, month, year))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teacher-attendance/report
// ─────────────────────────────────────────────
export const getReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await teacherAttendanceService.getReport({
      month:     req.query.month ? parseInt(req.query.month as string) : undefined,
      year:      req.query.year  ? parseInt(req.query.year  as string) : undefined,
      week:      req.query.week  ? parseInt(req.query.week  as string) : undefined,
      date:      req.query.date as string | undefined,
      teacherId: req.query.teacherId ? parseInt(req.query.teacherId as string) : undefined,
    })
    res.json(report)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teacher-attendance/:id
// ─────────────────────────────────────────────
export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attendance = await teacherAttendanceService.updateAttendance(parseInt(req.params.id), req.body)
    res.json({ message: 'Asistencia actualizada', attendance })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/mark-absent
// ─────────────────────────────────────────────
export const markAbsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await teacherAttendanceService.markAbsent()
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/public/check-in
// ─────────────────────────────────────────────
export const publicCheckIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await teacherAttendanceService.publicCheckIn(req.body.code)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/teacher-attendance/public/check-out
// ─────────────────────────────────────────────
export const publicCheckOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await teacherAttendanceService.publicCheckOut(req.body.code)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

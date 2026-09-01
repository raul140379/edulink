import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { studentAttendanceService } from '../services/studentAttendance.service'

// ─────────────────────────────────────────────
// GET /api/student-attendance/course/:courseId
// ─────────────────────────────────────────────
export const getAttendanceByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentAttendanceService.getAttendanceByCourse(req.userId, parseInt(req.params.courseId), req.query.date as string | undefined)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/student-attendance/course/:courseId
// ─────────────────────────────────────────────
export const saveAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentAttendanceService.saveAttendance(req.userId, parseInt(req.params.courseId), req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/student-attendance/today-status
// ─────────────────────────────────────────────
export const getTodayStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentAttendanceService.getTodayStatus())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/student-attendance/my-courses
// ─────────────────────────────────────────────
export const getMyCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentAttendanceService.getMyCourses(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/student-attendance/history/:studentId
// ─────────────────────────────────────────────
export const getStudentHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId, month } = req.query
    const result = await studentAttendanceService.getStudentHistory(
      parseInt(req.params.studentId), courseId ? parseInt(courseId as string) : undefined, month as string | undefined
    )
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/student-attendance/course/:courseId/close
// ─────────────────────────────────────────────
export const closeAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentAttendanceService.closeAttendance(req.userId, parseInt(req.params.courseId), req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

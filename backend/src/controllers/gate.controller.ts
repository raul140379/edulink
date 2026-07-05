import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { gateService } from '../services/gate.service'

// GET /api/gate/teacher/:code
export const getTeacherByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.getTeacherByCode(req.params.code))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/gate/student/:code
export const getStudentByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.getStudentByCode(req.params.code))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/student
export const registerStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await gateService.registerStudent(req.userId, req.body)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/gate/staff/:code
export const getStaffByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.getStaffByCode(req.params.code))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/gate/expected-today
export const getExpectedToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.getExpectedToday())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/teacher
export const registerTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await gateService.registerTeacher(req.userId, req.body)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/staff
export const registerStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await gateService.registerStaff(req.userId, req.body)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/visitor
export const registerVisitor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await gateService.registerVisitor(req.userId, req.body)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/mark-absent
export const markAbsentTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.markAbsentTeachers())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/gate/records
export const getRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, type, action } = req.query
    res.json(await gateService.getRecords(date as string | undefined, type as string | undefined, action as string | undefined))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/gate/records/today-teachers
export const getTodayTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.getTodayTeachers())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/generate-codes
export const generateAttendanceCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.generateAttendanceCodes())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/gate/attendance-codes
export const getAttendanceCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gateService.getAttendanceCodes())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/gate/regenerate-code/:type/:id
export const regenerateCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await gateService.regenerateCode(req.params.type, parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

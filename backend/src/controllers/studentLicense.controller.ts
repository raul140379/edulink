import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { studentLicenseService } from '../services/studentLicense.service'

// POST /api/student-licenses
export const createLicense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLicenseService.createLicense(req.body, req.userId!)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/student-licenses/student/:studentId
export const getStudentLicenses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const licenses = await studentLicenseService.getLicensesForStudent(parseInt(req.params.studentId))
    res.json(licenses)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/student-licenses/:id/cancel
export const cancelLicense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLicenseService.cancelLicense(parseInt(req.params.id), req.body, req.userId!)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

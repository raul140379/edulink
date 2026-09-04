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

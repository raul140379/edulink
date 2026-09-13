import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { studentLicenseRequestService } from '../services/studentLicenseRequest.service'

// POST /api/student-license-requests
export const createLicenseRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLicenseRequestService.createRequest(req.body, req.userId)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/student-license-requests/mine
export const getMyLicenseRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentLicenseRequestService.getMine(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/student-license-requests
export const getAllLicenseRequests = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentLicenseRequestService.getAll())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/student-license-requests/student/:studentId/pending-count
export const getPendingCountForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await studentLicenseRequestService.countPendingForStudent(parseInt(req.params.studentId))
    res.json({ count })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/student-license-requests/:id/approve
export const approveLicenseRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLicenseRequestService.approve(parseInt(req.params.id), req.body, req.userId!)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/student-license-requests/:id/reject
export const rejectLicenseRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentLicenseRequestService.reject(parseInt(req.params.id), req.body, req.userId!)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

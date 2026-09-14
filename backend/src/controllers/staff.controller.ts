import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { staffService } from '../services/staff.service'

// ─────────────────────────────────────────────
// GET /api/staff
// ─────────────────────────────────────────────
export const getStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive } = req.query
    const staff = await staffService.listStaff(search as string | undefined, isActive as string | undefined)
    res.json(staff)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/staff/:id
// ─────────────────────────────────────────────
export const getStaffById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staff = await staffService.getStaffById(parseInt(req.params.id))
    res.json(staff)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/staff
// ─────────────────────────────────────────────
export const createStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await staffService.createStaff(req.body)
    res.status(201).json({ message: 'Personal administrativo registrado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/staff/:id
// ─────────────────────────────────────────────
export const updateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staff = await staffService.updateStaff(parseInt(req.params.id), req.body)
    res.json({ message: 'Personal administrativo actualizado correctamente', staff })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/staff/:id/toggle
// ─────────────────────────────────────────────
export const toggleStaffStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const newStatus = await staffService.toggleStaffStatus(parseInt(req.params.id))
    res.json({ message: newStatus ? 'Personal activado' : 'Personal desactivado' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

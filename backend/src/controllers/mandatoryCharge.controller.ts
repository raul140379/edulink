import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { mandatoryChargeService } from '../services/mandatoryCharge.service'

// ─────────────────────────────────────────────
// GET /api/treasury/mandatory-charges
// ─────────────────────────────────────────────
export const getMandatoryCharges = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await mandatoryChargeService.list())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/mandatory-charges
// ─────────────────────────────────────────────
export const createMandatoryCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await mandatoryChargeService.create(req.body)
    res.status(201).json({ message: `Cargo obligatorio creado y aplicado a ${result.appliedCount} tutor(es)`, ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/treasury/mandatory-charges/:id/toggle
// ─────────────────────────────────────────────
export const toggleMandatoryCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await mandatoryChargeService.toggle(parseInt(req.params.id))
    res.json({ message: result.isActive ? 'Cargo obligatorio activado' : 'Cargo obligatorio desactivado', mandatoryCharge: result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/mandatory-charges/:id/apply-missing
// ─────────────────────────────────────────────
export const applyMandatoryChargeToMissing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await mandatoryChargeService.applyToMissing(parseInt(req.params.id))
    res.json({ message: result.appliedCount > 0 ? `Se aplicó el cargo a ${result.appliedCount} tutor(es) que no lo tenían` : 'Ningún tutor tenía este cargo pendiente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

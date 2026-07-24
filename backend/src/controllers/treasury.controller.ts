import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { hasPermission, Permission } from '../config/permissions'
import { assertOwnParentAccount } from '../utils/ownership-guards'
import { treasuryService } from '../services/treasury.service'

// ─────────────────────────────────────────────
// GET /api/treasury
// ─────────────────────────────────────────────
export const getCharges = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, type, parentId, academicYearId } = req.query
    const charges = await treasuryService.listCharges(
      status as string | undefined, type as string | undefined,
      parentId as string | undefined, academicYearId as string | undefined
    )
    res.json(charges)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/:id
// ─────────────────────────────────────────────
export const getChargeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const charge = await treasuryService.getChargeById(parseInt(req.params.id))
    res.json(charge)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/parents/:parentId/account
// ─────────────────────────────────────────────
export const getParentAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parentId = parseInt(req.params.parentId)
    if (!hasPermission(req.userRole!, Permission.CHARGE_VIEW_ALL)) {
      await assertOwnParentAccount(req, parentId)
    }
    const result = await treasuryService.getParentAccount(parentId)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury
// ─────────────────────────────────────────────
export const createCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const charge = await treasuryService.createCharge(req.body)
    res.status(201).json({ message: 'Cargo registrado correctamente', charge })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/bulk
// ─────────────────────────────────────────────
export const createBulkCharges = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await treasuryService.createBulkCharges(req.body)
    res.status(201).json({ message: `${result.created} cargos creados correctamente`, ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/treasury/:id
// ─────────────────────────────────────────────
export const updateCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const charge = await treasuryService.updateCharge(parseInt(req.params.id), req.body)
    res.json({ message: 'Cargo actualizado correctamente', charge })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/treasury/:id/cancel
// ─────────────────────────────────────────────
export const cancelCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await treasuryService.cancelCharge(parseInt(req.params.id))
    res.json({ message: 'Cargo anulado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/:id/payments
// ─────────────────────────────────────────────
export const registerPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await treasuryService.registerPayment(parseInt(req.params.id), req.body)
    res.status(201).json({ message: `Pago de Bs. ${result.payment.amount.toFixed(2)} registrado correctamente`, ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/summary
// ─────────────────────────────────────────────
export const getTreasurySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const summary = await treasuryService.getSummary(req.query.academicYearId as string | undefined)
    res.json(summary)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/treasury/parents
// ─────────────────────────────────────────────
export const getParentsWithBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId, search, status } = req.query
    const parents = await treasuryService.getParentsWithBalance(
      academicYearId as string | undefined, search as string | undefined, status as string | undefined
    )
    res.json(parents)
  } catch (error) {
    handleControllerError(res, error)
  }
}

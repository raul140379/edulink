import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { academicClosureService } from '../services/academicClosure.service'

// ─────────────────────────────────────────────
// GET /api/treasury/academic-years
// ─────────────────────────────────────────────
export const getAcademicYearsClosureStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await academicClosureService.list())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/academic-years/:id/close-economic-period
// ─────────────────────────────────────────────
export const closeEconomicPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicClosureService.closeEconomicPeriod(parseInt(req.params.id), req.userId!)
    res.json({
      message: result.carriedCount > 0
        ? `Gestión cerrada económicamente — se trasladaron ${result.carriedCount} cargo(s) pendiente(s) como Deuda Anterior`
        : 'Gestión cerrada económicamente — no había cargos pendientes que trasladar',
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/academic-years/:id/reopen-economic-period
// ─────────────────────────────────────────────
export const reopenEconomicPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = await academicClosureService.reopenEconomicPeriod(parseInt(req.params.id))
    res.json({ message: 'Gestión reabierta económicamente — los traslados de deuda ya realizados no se deshacen', academicYear: year })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/treasury/:id/historical-correction
// ─────────────────────────────────────────────
export const correctHistoricalCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicClosureService.correctHistoricalCharge(parseInt(req.params.id), req.body)
    res.json({ message: 'Cargo corregido correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/:id/carry-forward
// ─────────────────────────────────────────────
export const carryForwardSingleCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicClosureService.carryForwardSingleCharge(parseInt(req.params.id))
    res.json({ message: 'Cargo trasladado a la gestión activa correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/create-and-carry-forward
// ─────────────────────────────────────────────
export const createAndCarryForwardCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicClosureService.createAndCarryForwardCharge(req.body)
    res.status(201).json({
      message: result.carried ? 'Cargo creado y trasladado a la gestión activa correctamente' : 'Cargo creado — quedó pagado por completo, no había saldo que trasladar',
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/create-historical-charge
// ─────────────────────────────────────────────
export const createHistoricalCharge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicClosureService.createHistoricalCharge(req.body)
    res.status(201).json({ message: 'Cargo histórico registrado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/course/:courseId/import-aportes/preview
// ─────────────────────────────────────────────
export const previewCourseImport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No se subió ningún archivo' }); return }
    const mandatoryChargeId = parseInt(req.body.mandatoryChargeId)
    if (!mandatoryChargeId) { res.status(400).json({ message: 'Falta indicar el tipo de aporte' }); return }
    const result = await academicClosureService.previewCourseImport(parseInt(req.params.courseId), mandatoryChargeId, req.file.buffer)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/course/:courseId/import-aportes/apply
// ─────────────────────────────────────────────
export const applyCourseImport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No se subió ningún archivo' }); return }
    const mandatoryChargeId = parseInt(req.body.mandatoryChargeId)
    if (!mandatoryChargeId) { res.status(400).json({ message: 'Falta indicar el tipo de aporte' }); return }
    const result = await academicClosureService.applyCourseImport(parseInt(req.params.courseId), mandatoryChargeId, req.file.buffer)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/treasury/:id/refund
// ─────────────────────────────────────────────
export const registerRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicClosureService.registerRefund(parseInt(req.params.id), req.body)
    res.status(201).json({ message: 'Devolución registrada correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

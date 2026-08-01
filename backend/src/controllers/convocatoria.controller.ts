import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { convocatoriaService } from '../services/convocatoria.service'

// ─────────────────────────────────────────────
// GET /api/convocatorias
// ─────────────────────────────────────────────
export const getConvocatorias = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await convocatoriaService.listConvocatorias())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/convocatorias/:id
// ─────────────────────────────────────────────
export const getConvocatoriaById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await convocatoriaService.getById(parseInt(req.params.id)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/convocatorias
// ─────────────────────────────────────────────
export const createConvocatoria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const convocatoria = await convocatoriaService.createConvocatoria(req.userId as number, req.body)
    res.status(201).json({ message: 'Convocatoria creada correctamente', convocatoria })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/convocatorias/:id
// ─────────────────────────────────────────────
export const updateConvocatoria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const convocatoria = await convocatoriaService.updateConvocatoria(parseInt(req.params.id), req.body)
    res.json({ message: 'Convocatoria actualizada correctamente', convocatoria })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/convocatorias/:id/cancel
// ─────────────────────────────────────────────
export const cancelConvocatoria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await convocatoriaService.cancelConvocatoria(parseInt(req.params.id))
    res.json({ message: 'Convocatoria cancelada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/convocatorias/:id/attendance
// ─────────────────────────────────────────────
export const updateConvocatoriaAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await convocatoriaService.updateAttendance(parseInt(req.params.id), req.body)
    res.json({ message: 'Asistencia actualizada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/convocatorias/:id/close — cierra y genera multas automáticamente
// ─────────────────────────────────────────────
export const closeConvocatoria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await convocatoriaService.closeConvocatoria(parseInt(req.params.id), req.body.academicYearId)
    res.json({ message: `Convocatoria cerrada — ${result.charged} multa(s) generada(s)`, ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

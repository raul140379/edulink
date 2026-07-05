import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { academicService } from '../services/academic.service'

// GET /api/academic
export const getAcademicYears = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await academicService.getAcademicYears())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/academic/active
export const getActiveYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await academicService.getActiveYear())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/academic
export const createAcademicYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const academicYear = await academicService.createAcademicYear(req.body)
    res.status(201).json({ message: 'Gestión creada correctamente', academicYear })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// PUT /api/academic/:id
export const updateAcademicYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const academicYear = await academicService.updateAcademicYear(parseInt(req.params.id), req.body)
    res.json({ message: 'Gestión actualizada', academicYear })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// PATCH /api/academic/:id/toggle
export const toggleAcademicYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicService.toggleAcademicYear(parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/academic/:yearId/trimesters
export const getTrimesters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await academicService.getTrimesters(parseInt(req.params.yearId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/academic/:yearId/trimesters
export const createTrimester = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trimester = await academicService.createTrimester(parseInt(req.params.yearId), req.body)
    res.status(201).json({ message: 'Trimestre creado', trimester })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// GET /api/academic/:yearId/holidays
export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await academicService.getHolidays(parseInt(req.params.yearId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/academic/:yearId/holidays
export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const holiday = await academicService.createHoliday(parseInt(req.params.yearId), req.body)
    res.status(201).json({ message: 'Feriado registrado', holiday })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// DELETE /api/academic/:yearId/holidays/:id
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await academicService.deleteHoliday(parseInt(req.params.id))
    res.json({ message: 'Feriado eliminado' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// PATCH /api/academic/:yearId/trimesters/:id/toggle-close
export const toggleCloseTrimester = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await academicService.toggleCloseTrimester(parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

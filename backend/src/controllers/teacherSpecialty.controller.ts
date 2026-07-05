import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { teacherSpecialtyService } from '../services/teacherSpecialty.service'

// GET /api/teachers/:id/specialties
export const getTeacherSpecialties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await teacherSpecialtyService.getTeacherSpecialties(parseInt(req.params.id)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// POST /api/teachers/:id/specialties — asignar especialidad
export const addTeacherSpecialty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const specialty = await teacherSpecialtyService.addTeacherSpecialty(parseInt(req.params.id), req.body)
    res.status(201).json({ message: 'Especialidad asignada', specialty })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// DELETE /api/teachers/:id/specialties/:specialtyId — quitar especialidad
export const removeTeacherSpecialty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await teacherSpecialtyService.removeTeacherSpecialty(parseInt(req.params.specialtyId))
    res.json({ message: 'Especialidad removida' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

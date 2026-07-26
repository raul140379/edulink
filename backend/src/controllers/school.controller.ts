import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { schoolService } from '../services/school.service'

export const getSchools = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await schoolService.listSchools())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getSchoolById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await schoolService.getSchoolById(parseInt(req.params.id)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const createSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const school = await schoolService.createSchool(req.body)
    res.status(201).json({ message: 'Unidad educativa creada correctamente', school })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const school = await schoolService.updateSchool(parseInt(req.params.id), req.body)
    res.json({ message: 'Unidad educativa actualizada', school })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const importSchools = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No se subió ningún archivo' }); return }
    const result = await schoolService.importSchools(req.file.buffer, req.userDistrictId)
    res.status(201).json({
      message: `Importación completada: ${result.created.length} creados, ${result.skipped.length} omitidos, ${result.errors.length} errores`,
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

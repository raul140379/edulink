import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { poaActaService } from '../services/poa-acta.service'

export const getPoaActas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await poaActaService.listPoaActas())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const upsertMyPoaActa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const acta = await poaActaService.upsertMyPoaActa(req.body, req.file, req.userSchoolId, req.userId)
    res.status(201).json({ message: 'Acta de POA guardada correctamente', acta })
  } catch (error) {
    handleControllerError(res, error)
  }
}

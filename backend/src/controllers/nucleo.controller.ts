import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { nucleoService } from '../services/nucleo.service'

export const getNucleos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await nucleoService.listNucleos())
  } catch (error) {
    handleControllerError(res, error)
  }
}

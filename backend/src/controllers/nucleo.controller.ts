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

export const createNucleo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nucleo = await nucleoService.createNucleo(req.body)
    res.status(201).json({ message: 'Núcleo creado correctamente', nucleo })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateNucleo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nucleo = await nucleoService.updateNucleo(parseInt(req.params.id), req.body)
    res.json({ message: 'Núcleo actualizado', nucleo })
  } catch (error) {
    handleControllerError(res, error)
  }
}

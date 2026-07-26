import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { juntaService } from '../services/junta.service'

export const getJuntaMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await juntaService.listJuntaMembers())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const createJuntaMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const member = await juntaService.createJuntaMember(req.body)
    res.status(201).json({ message: 'Miembro de junta creado correctamente', member })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateJuntaMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const member = await juntaService.updateJuntaMember(parseInt(req.params.id), req.body)
    res.json({ message: 'Miembro de junta actualizado', member })
  } catch (error) {
    handleControllerError(res, error)
  }
}

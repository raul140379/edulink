import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { gobiernoService } from '../services/gobierno.service'

export const getGobiernoMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await gobiernoService.listGobiernoMembers())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const createGobiernoMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const member = await gobiernoService.createGobiernoMember(req.body)
    res.status(201).json({ message: 'Miembro de gobierno estudiantil creado correctamente', member })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateGobiernoMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const member = await gobiernoService.updateGobiernoMember(parseInt(req.params.id), req.body)
    res.json({ message: 'Miembro de gobierno estudiantil actualizado', member })
  } catch (error) {
    handleControllerError(res, error)
  }
}

import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { sportsParticipantService } from '../services/sportsParticipant.service'

export const listParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await sportsParticipantService.listParticipants())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const registerParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await sportsParticipantService.registerParticipants(req.body, req.userId)
    res.status(201).json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const removeParticipant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await sportsParticipantService.removeParticipant(parseInt(req.params.id, 10))
    res.json({ message: 'Registro eliminado' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

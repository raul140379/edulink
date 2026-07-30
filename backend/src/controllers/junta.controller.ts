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

export const toggleJuntaMemberStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isActive = await juntaService.toggleJuntaMemberStatus(parseInt(req.params.id), req.userId as number)
    res.json({ message: isActive ? 'Miembro reactivado' : 'Miembro desactivado', isActive })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyJuntaProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await juntaService.getOwnProfile(req.userId as number))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateMyJuntaProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const member = await juntaService.updateOwnProfile(req.userId as number, req.body)
    res.json({ message: 'Perfil actualizado', member })
  } catch (error) {
    handleControllerError(res, error)
  }
}

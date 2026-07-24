import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { comunicadoService } from '../services/comunicado.service'

export const getComunicados = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await comunicadoService.listComunicados())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const createComunicado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comunicado = await comunicadoService.createComunicado(req.body)
    res.status(201).json({ message: 'Comunicado publicado correctamente', comunicado })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateComunicado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comunicado = await comunicadoService.updateComunicado(parseInt(req.params.id), req.body)
    res.json({ message: 'Comunicado actualizado', comunicado })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const deleteComunicado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await comunicadoService.deleteComunicado(parseInt(req.params.id))
    res.json({ message: 'Comunicado despublicado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

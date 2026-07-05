import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { authService } from '../services/auth.service'
import { handleControllerError } from '../utils/http-error'

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await authService.login(req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// OBTENER USUARIO ACTUAL (GET /api/auth/me)
// ─────────────────────────────────────────────
export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await authService.getMe(req.userId as number)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// CAMBIAR CONTRASEÑA (PUT /api/auth/change-password)
// ─────────────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await authService.changePassword(req.userId as number, req.body)
    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

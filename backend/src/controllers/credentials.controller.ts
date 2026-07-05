import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { credentialsService } from '../services/credentials.service'

export const resetCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { buffer, filename } = await credentialsService.resetCredentials(req.body)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.send(buffer)
  } catch (error) {
    handleControllerError(res, error)
  }
}

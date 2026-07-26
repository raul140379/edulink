import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { districtService } from '../services/district.service'

export const getMyDistrict = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await districtService.getMyDistrict())
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateMyDistrict = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await districtService.updateMyDistrict(req.body))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateMyDistrictLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await districtService.updateMyDistrictLogo(req.file, req.userDistrictId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

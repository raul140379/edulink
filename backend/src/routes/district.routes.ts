import { Router } from 'express'
import multer from 'multer'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { updateDistrictSchema } from '../schemas/district.schema'
import { getMyDistrict, updateMyDistrict, updateMyDistrictLogo } from '../controllers/district.controller'

const upload = multer({ storage: multer.memoryStorage() })

const router = Router()
router.use(verifyToken)

router.get('/me',   requirePermission(Permission.DISTRICT_MANAGE), getMyDistrict)
router.put('/',     requirePermission(Permission.DISTRICT_MANAGE), validateBody(updateDistrictSchema), updateMyDistrict)
router.post('/logo', requirePermission(Permission.DISTRICT_MANAGE), upload.single('file'), updateMyDistrictLogo)

export default router

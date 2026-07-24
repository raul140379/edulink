import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import { getNucleos } from '../controllers/nucleo.controller'

const router = Router()
router.use(verifyToken)

router.get('/', requirePermission(Permission.SCHOOL_VIEW_ALL), getNucleos)

export default router

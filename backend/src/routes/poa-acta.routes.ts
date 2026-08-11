import { Router } from 'express'
import multer from 'multer'
import { verifyToken, requirePermission, restoreTenantContext } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import { getPoaActas, upsertMyPoaActa } from '../controllers/poa-acta.controller'

const upload = multer({ storage: multer.memoryStorage() })

const router = Router()
router.use(verifyToken)

router.get('/', requirePermission(Permission.CHARGE_VIEW_ALL), getPoaActas)
router.post('/', requirePermission(Permission.CHARGE_CREATE), upload.single('file'), restoreTenantContext, upsertMyPoaActa)

export default router

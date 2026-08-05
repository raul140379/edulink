import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { checkInSchema } from '../schemas/attendance-checkin.schema'
import { checkIn } from '../controllers/attendance-checkin.controller'

const router = Router()

router.use(verifyToken)

// Sin candado de cargo — cualquier Junta Escolar puede operar el punto de
// registro (ver attendance-checkin.service.ts para el razonamiento).
router.post('/', requirePermission(Permission.MEETING_VIEW), validateBody(checkInSchema), checkIn)

export default router

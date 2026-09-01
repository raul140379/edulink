import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createSportsParticipantSchema } from '../schemas/sportsParticipant.schema'
import { listParticipants, registerParticipants, removeParticipant } from '../controllers/sportsParticipant.controller'

const router = Router()
router.use(verifyToken)

router.get('/',       requirePermission(Permission.SPORTS_MANAGE), listParticipants)
router.post('/',      requirePermission(Permission.SPORTS_MANAGE), validateBody(createSportsParticipantSchema), registerParticipants)
router.delete('/:id', requirePermission(Permission.SPORTS_MANAGE), removeParticipant)

export default router

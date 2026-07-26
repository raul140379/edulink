import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createGobiernoMemberSchema, updateGobiernoMemberSchema } from '../schemas/gobierno.schema'
import { getGobiernoMembers, createGobiernoMember, updateGobiernoMember } from '../controllers/gobierno.controller'

const router = Router()
router.use(verifyToken)

router.get('/',    requirePermission(Permission.GOBIERNO_MANAGE), getGobiernoMembers)
router.post('/',   requirePermission(Permission.GOBIERNO_MANAGE), validateBody(createGobiernoMemberSchema), createGobiernoMember)
router.put('/:id', requirePermission(Permission.GOBIERNO_MANAGE), validateBody(updateGobiernoMemberSchema), updateGobiernoMember)

export default router

import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createJuntaMemberSchema, updateJuntaMemberSchema } from '../schemas/junta.schema'
import { getJuntaMembers, createJuntaMember, updateJuntaMember } from '../controllers/junta.controller'

const router = Router()
router.use(verifyToken)

router.get('/',    requirePermission(Permission.JUNTA_MANAGE), getJuntaMembers)
router.post('/',   requirePermission(Permission.JUNTA_MANAGE), validateBody(createJuntaMemberSchema), createJuntaMember)
router.put('/:id', requirePermission(Permission.JUNTA_MANAGE), validateBody(updateJuntaMemberSchema), updateJuntaMember)

export default router

import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createNucleoSchema, updateNucleoSchema } from '../schemas/nucleo.schema'
import { getNucleos, createNucleo, updateNucleo } from '../controllers/nucleo.controller'

const router = Router()
router.use(verifyToken)

router.get('/',    requirePermission(Permission.SCHOOL_VIEW_ALL), getNucleos)
router.post('/',   requirePermission(Permission.DISTRICT_MANAGE), validateBody(createNucleoSchema), createNucleo)
router.put('/:id', requirePermission(Permission.DISTRICT_MANAGE), validateBody(updateNucleoSchema), updateNucleo)

export default router

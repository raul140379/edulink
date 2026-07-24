import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createComunicadoSchema, updateComunicadoSchema } from '../schemas/comunicado.schema'
import { getComunicados, createComunicado, updateComunicado, deleteComunicado } from '../controllers/comunicado.controller'

const router = Router()
router.use(verifyToken)

router.get('/',    requirePermission(Permission.COMUNICADO_VIEW), getComunicados)
router.post('/',   requirePermission(Permission.COMUNICADO_CREATE), validateBody(createComunicadoSchema), createComunicado)
router.put('/:id', requirePermission(Permission.COMUNICADO_CREATE), validateBody(updateComunicadoSchema), updateComunicado)
router.delete('/:id', requirePermission(Permission.COMUNICADO_CREATE), deleteComunicado)

export default router

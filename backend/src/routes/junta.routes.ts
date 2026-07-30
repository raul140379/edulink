import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createJuntaMemberSchema, updateJuntaMemberSchema, updateOwnJuntaProfileSchema } from '../schemas/junta.schema'
import {
  getJuntaMembers, createJuntaMember, updateJuntaMember, toggleJuntaMemberStatus,
  getMyJuntaProfile, updateMyJuntaProfile,
} from '../controllers/junta.controller'

const router = Router()
router.use(verifyToken)

// Rutas de auto-perfil ANTES que /:id — si no, Express matchea "me" como :id.
// Sin requirePermission(JUNTA_MANAGE): cualquier rol de junta (incluido
// JUNTA_ESCOLAR, que no tiene ese permiso) necesita leer/editar su propio perfil.
router.get('/me', getMyJuntaProfile)
router.put('/me', validateBody(updateOwnJuntaProfileSchema), updateMyJuntaProfile)

router.get('/',           requirePermission(Permission.JUNTA_MANAGE), getJuntaMembers)
router.post('/',          requirePermission(Permission.JUNTA_MANAGE), validateBody(createJuntaMemberSchema), createJuntaMember)
router.put('/:id',        requirePermission(Permission.JUNTA_MANAGE), validateBody(updateJuntaMemberSchema), updateJuntaMember)
router.patch('/:id/toggle', requirePermission(Permission.JUNTA_MANAGE), toggleJuntaMemberStatus)

export default router

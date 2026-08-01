import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  createConvocatoriaSchema, updateConvocatoriaSchema,
  updateConvocatoriaAttendanceSchema, closeConvocatoriaSchema,
} from '../schemas/convocatoria.schema'
import {
  getConvocatorias, getConvocatoriaById, createConvocatoria, updateConvocatoria,
  cancelConvocatoria, updateConvocatoriaAttendance, closeConvocatoria,
} from '../controllers/convocatoria.controller'

const router = Router()
router.use(verifyToken)

router.get('/',                requirePermission(Permission.CONVOCATORIA_VIEW),   getConvocatorias)
router.get('/:id',              requirePermission(Permission.CONVOCATORIA_VIEW),   getConvocatoriaById)
router.post('/',                requirePermission(Permission.CONVOCATORIA_CREATE), validateBody(createConvocatoriaSchema), createConvocatoria)
router.put('/:id',              requirePermission(Permission.CONVOCATORIA_CREATE), validateBody(updateConvocatoriaSchema), updateConvocatoria)
router.patch('/:id/cancel',     requirePermission(Permission.CONVOCATORIA_CREATE), cancelConvocatoria)
router.patch('/:id/attendance', requirePermission(Permission.CONVOCATORIA_CREATE), validateBody(updateConvocatoriaAttendanceSchema), updateConvocatoriaAttendance)
router.patch('/:id/close',      requirePermission(Permission.CONVOCATORIA_CREATE), validateBody(closeConvocatoriaSchema), closeConvocatoria)

export default router

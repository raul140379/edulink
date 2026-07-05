import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { assignDelegateSchema } from '../schemas/delegate.schema'
import {
  getDelegates,
  getEligibleParents,
  assignDelegate,
  removeDelegate,
  getMyCourse,
} from '../controllers/delegate.controller'

const router = Router()

router.use(verifyToken)

// Gestión de delegados (Junta Escolar)
router.get('/',                                    requirePermission(Permission.DELEGATE_MANAGE), getDelegates)
router.get('/course/:courseId/eligible-parents',   requirePermission(Permission.DELEGATE_MANAGE), getEligibleParents)
router.post('/course/:courseId/assign',            requirePermission(Permission.DELEGATE_MANAGE), validateBody(assignDelegateSchema), assignDelegate)
router.delete('/course/:courseId/remove',          requirePermission(Permission.DELEGATE_MANAGE), removeDelegate)

// Para el delegado logueado
router.get('/my-course',                           requirePermission(Permission.DELEGATE_VIEW_OWN), getMyCourse)

export default router

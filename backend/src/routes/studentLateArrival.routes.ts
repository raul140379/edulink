import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Role } from '../config/permissions'
import { createLateArrivalSchema } from '../schemas/studentLateArrival.schema'
import { createLateArrival, notifyParent, getTodayForCourse } from '../controllers/studentLateArrival.controller'

const router = Router()
router.use(verifyToken)

// Regente + Dirección/Secretaría — mismo criterio ya usado para Licencia.
router.post('/',              requireRole(Role.REGENTE, Role.DIRECTOR, Role.SECRETARY), validateBody(createLateArrivalSchema), createLateArrival)
router.post('/:id/notify',    requireRole(Role.REGENTE, Role.DIRECTOR, Role.SECRETARY), notifyParent)
router.get('/today/:courseId', requireRole(Role.REGENTE, Role.DIRECTOR, Role.SECRETARY), getTodayForCourse)

export default router

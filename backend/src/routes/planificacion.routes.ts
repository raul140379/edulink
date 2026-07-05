import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  generatePlanificacionSchema, saveSlotSchema, assignPlanPeriodSchema, promotePlanificacionSchema,
} from '../schemas/planificacion.schema'
import {
  generatePlanificacion,
  saveSlot,
  getSlotsStatus,
  getPlanificacionByCourse,
  getPlanificacionTeachers,
  assignPlanPeriod,
  deletePlanPeriod,
  clearSlot,
  promotePlanificacion,
} from '../controllers/planificacion.controller'

const router = Router()
router.use(verifyToken)

router.post('/generate',                requirePermission(Permission.SCHEDULE_CREATE), validateBody(generatePlanificacionSchema), generatePlanificacion)
router.post('/save-slot',               requirePermission(Permission.SCHEDULE_CREATE), validateBody(saveSlotSchema), saveSlot)
router.get('/slots-status',             requirePermission(Permission.SCHEDULE_VIEW_ALL), getSlotsStatus)
router.get('/course/:courseId',         requirePermission(Permission.SCHEDULE_VIEW_ALL), getPlanificacionByCourse)
router.get('/teachers',                 requirePermission(Permission.SCHEDULE_VIEW_ALL), getPlanificacionTeachers)
router.post('/course/:courseId/period', requirePermission(Permission.SCHEDULE_CREATE), validateBody(assignPlanPeriodSchema), assignPlanPeriod)
router.delete('/slot/:slot',            requirePermission(Permission.SCHEDULE_CREATE), clearSlot)
router.delete('/:id',                   requirePermission(Permission.SCHEDULE_CREATE), deletePlanPeriod)
router.post('/promote',                 requirePermission(Permission.SCHEDULE_CREATE), validateBody(promotePlanificacionSchema), promotePlanificacion)

export default router

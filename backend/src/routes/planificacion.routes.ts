import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
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

router.post('/generate',                requirePermission(Permission.USER_CREATE), generatePlanificacion)
router.post('/save-slot',               requirePermission(Permission.USER_CREATE), saveSlot)
router.get('/slots-status',             getSlotsStatus)
router.get('/course/:courseId',         getPlanificacionByCourse)
router.get('/teachers',                 getPlanificacionTeachers)
router.post('/course/:courseId/period', requirePermission(Permission.USER_CREATE), assignPlanPeriod)
router.delete('/slot/:slot',            requirePermission(Permission.USER_CREATE), clearSlot)
router.delete('/:id',                   requirePermission(Permission.USER_CREATE), deletePlanPeriod)
router.post('/promote',                 requirePermission(Permission.USER_CREATE), promotePlanificacion)

export default router
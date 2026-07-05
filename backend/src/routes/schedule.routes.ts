import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createSchoolScheduleSchema, updateSchoolScheduleSchema, assignPeriodSchema } from '../schemas/schedule.schema'
import {
  getSchoolSchedules,
  createSchoolSchedule,
  updateSchoolSchedule,
  getPeriodos,
  getCourseSchedule,
  assignPeriod,
  deletePeriod,
  getTeacherSchedule,
  getMySchedule,
  generateSchedule,
  publishSchedule,
  deleteDraft,
  getTscsByCourse,
  deleteAllSchedule,
  getPeriodsSummary,
} from '../controllers/schedule.controller'

const router = Router()
router.use(verifyToken)

// Configuración institucional
router.get('/school-schedules',           requirePermission(Permission.SCHEDULE_VIEW_ALL), getSchoolSchedules)
router.post('/school-schedules',          requirePermission(Permission.SCHEDULE_CREATE), validateBody(createSchoolScheduleSchema), createSchoolSchedule)
router.put('/school-schedules/:id',       requirePermission(Permission.SCHEDULE_CREATE), validateBody(updateSchoolScheduleSchema), updateSchoolSchedule)
router.get('/periodos/:schoolScheduleId', requirePermission(Permission.SCHEDULE_VIEW_ALL), getPeriodos)

// Horario por curso
// Sin requirePermission: la usan padres/estudiantes (SCHEDULE_VIEW_OWN) para ver el
// horario de su propio curso, y admins (SCHEDULE_VIEW_ALL) para cualquier curso.
router.get('/course/:courseId',           getCourseSchedule)
router.post('/course/:courseId/period',   requirePermission(Permission.SCHEDULE_CREATE), validateBody(assignPeriodSchema), assignPeriod)
router.delete('/course/:courseId/all',    requirePermission(Permission.SCHEDULE_CREATE), deleteAllSchedule)
router.delete('/draft/:courseId',         requirePermission(Permission.SCHEDULE_CREATE), deleteDraft)
router.delete('/:id',                     requirePermission(Permission.SCHEDULE_CREATE), deletePeriod)
router.post('/generate/:courseId',        requirePermission(Permission.SCHEDULE_CREATE), generateSchedule)
router.post('/publish/:courseId',         requirePermission(Permission.SCHEDULE_CREATE), publishSchedule)
router.get('/tscs/:courseId',             requirePermission(Permission.SCHEDULE_VIEW_ALL), getTscsByCourse)
router.get('/course/:courseId/periods-summary', requirePermission(Permission.SCHEDULE_VIEW_ALL), getPeriodsSummary)

// Horario por maestro
router.get('/teacher/:teacherId',         requirePermission(Permission.SCHEDULE_VIEW_ALL), getTeacherSchedule)
router.get('/my-schedule',                getMySchedule)

export default router
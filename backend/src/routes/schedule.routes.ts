import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
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
} from '../controllers/schedule.controller'

const router = Router()
router.use(verifyToken)

// Configuración institucional
router.get('/school-schedules',           getSchoolSchedules)
router.post('/school-schedules',          requirePermission(Permission.USER_CREATE), createSchoolSchedule)
router.put('/school-schedules/:id',       requirePermission(Permission.USER_CREATE), updateSchoolSchedule)
router.get('/periodos/:schoolScheduleId', getPeriodos)

// Horario por curso
router.get('/course/:courseId',           getCourseSchedule)
router.post('/course/:courseId/period',   requirePermission(Permission.USER_CREATE), assignPeriod)
router.delete('/course/:courseId/all',    requirePermission(Permission.USER_CREATE), deleteAllSchedule)
router.delete('/draft/:courseId',         requirePermission(Permission.USER_CREATE), deleteDraft)
router.delete('/:id',                     requirePermission(Permission.USER_CREATE), deletePeriod)
router.post('/generate/:courseId',        requirePermission(Permission.USER_CREATE), generateSchedule)
router.post('/publish/:courseId',         requirePermission(Permission.USER_CREATE), publishSchedule)
router.get('/tscs/:courseId',             getTscsByCourse)

// Horario por maestro
router.get('/teacher/:teacherId',         getTeacherSchedule)
router.get('/my-schedule',                getMySchedule)

export default router
import { Router } from 'express'
import { verifyToken, requirePermission, requireAnyPermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { saveAttendanceSchema, closeAttendanceSchema } from '../schemas/studentAttendance.schema'
import {
  getAttendanceByCourse,
  saveAttendance,
  getMyCourses,
  getStudentHistory,
  closeAttendance,
  getTodayStatus,
} from '../controllers/studentAttendance.controller'

const router = Router()
router.use(verifyToken)

router.get('/today-status',            requirePermission(Permission.ATTENDANCE_VIEW), getTodayStatus)
router.get('/my-courses',              requirePermission(Permission.COURSE_VIEW_OWN), getMyCourses)
router.get('/course/:courseId',        requirePermission(Permission.ATTENDANCE_VIEW), getAttendanceByCourse)
router.post('/course/:courseId',       requirePermission(Permission.ATTENDANCE_CREATE), validateBody(saveAttendanceSchema), saveAttendance)
router.get('/history/:studentId',      requireAnyPermission(Permission.ATTENDANCE_VIEW, Permission.ATTENDANCE_VIEW_OWN), getStudentHistory)
router.post('/course/:courseId/close', requirePermission(Permission.ATTENDANCE_CREATE), validateBody(closeAttendanceSchema), closeAttendance)

export default router

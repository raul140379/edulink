import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import {
  getTeachersReport,
  getDelegatesReport,
  getTreasuryReport,
  getAttendanceReport,
  getCarriedDebtReport,
  getDailyAttendanceCompliance,
  getDailyAttendanceCourseDetail,
  getWeeklyAttendanceMatrix,
} from '../controllers/report.controller'

const router = Router()

router.use(verifyToken)

router.get('/teachers',      requirePermission(Permission.REPORT_VIEW), getTeachersReport)
router.get('/delegates',     requirePermission(Permission.REPORT_VIEW), getDelegatesReport)
router.get('/treasury',      requirePermission(Permission.CHARGE_VIEW_ALL), getTreasuryReport)
router.get('/attendance',    requirePermission(Permission.REPORT_VIEW), getAttendanceReport)
router.get('/carried-debt',  requirePermission(Permission.CHARGE_VIEW_ALL), getCarriedDebtReport)
// Rutas específicas antes de la paramétrica :courseId.
router.get('/attendance-daily',            requirePermission(Permission.REPORT_VIEW), getDailyAttendanceCompliance)
router.get('/attendance-daily/:courseId',  requirePermission(Permission.REPORT_VIEW), getDailyAttendanceCourseDetail)
router.get('/attendance-weekly/:courseId', requirePermission(Permission.REPORT_VIEW), getWeeklyAttendanceMatrix)

export default router

import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import {
  getTeachersReport,
  getDelegatesReport,
  getTreasuryReport,
  getAttendanceReport,
} from '../controllers/report.controller'

const router = Router()

router.use(verifyToken)

router.get('/teachers',   requirePermission(Permission.REPORT_VIEW), getTeachersReport)
router.get('/delegates',  requirePermission(Permission.REPORT_VIEW), getDelegatesReport)
router.get('/treasury',   requirePermission(Permission.CHARGE_VIEW_ALL), getTreasuryReport)
router.get('/attendance', requirePermission(Permission.REPORT_VIEW), getAttendanceReport)

export default router

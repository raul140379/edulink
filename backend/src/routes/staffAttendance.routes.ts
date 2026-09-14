import { Router } from 'express'
import { getReport } from '../controllers/staffAttendance.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/report', requirePermission(Permission.ATTENDANCE_VIEW), getReport)

export default router

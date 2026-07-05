import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { updateTeacherAttendanceSchema, publicCodeSchema } from '../schemas/teacherAttendance.schema'
import {
  checkIn,
  checkOut,
  getMyToday,
  getMyHistory,
  getReport,
  updateAttendance,
  markAbsent,
  publicCheckIn,
  publicCheckOut,
} from '../controllers/teacherAttendance.controller'

const router = Router()

// Rutas públicas — sin autenticación (kiosco con código de asistencia)
router.post('/public/check-in',  validateBody(publicCodeSchema), publicCheckIn)
router.post('/public/check-out', validateBody(publicCodeSchema), publicCheckOut)
router.use(verifyToken)

// Maestro
router.post('/check-in',    checkIn)
router.post('/check-out',   checkOut)
router.get('/my-today',     getMyToday)
router.get('/my-history',   getMyHistory)

// Admin / Director / Secretaria / Junta
router.get('/report', requirePermission(Permission.ATTENDANCE_VIEW), getReport)
router.patch('/:id',                               requirePermission(Permission.TEACHER_ATTENDANCE_MANAGE),   validateBody(updateTeacherAttendanceSchema), updateAttendance)
router.post('/mark-absent',                        requirePermission(Permission.TEACHER_ATTENDANCE_MANAGE),   markAbsent)

export default router

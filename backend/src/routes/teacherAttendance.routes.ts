import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
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

// Rutas públicas — sin autenticación
router.post('/public/check-in',  publicCheckIn)
router.post('/public/check-out', publicCheckOut)
router.use(verifyToken)

// Maestro
router.post('/check-in',    checkIn)
router.post('/check-out',   checkOut)
router.get('/my-today',     getMyToday)
router.get('/my-history',   getMyHistory)

// Admin / Director / Secretaria / Junta
router.get('/report',                              requirePermission(Permission.USER_VIEW_ALL), getReport)
router.patch('/:id',                               requirePermission(Permission.USER_CREATE),   updateAttendance)
router.post('/mark-absent',                        requirePermission(Permission.USER_CREATE),   markAbsent)

export default router
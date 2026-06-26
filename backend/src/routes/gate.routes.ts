import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getTeacherByCode,
  getStaffByCode,
  getExpectedToday,
  registerTeacher,
  registerStaff,
  registerVisitor,
  markAbsentTeachers,
  getRecords,
  getTodayTeachers,
  generateAttendanceCodes,
  getAttendanceCodes,
  regenerateCode,
} from '../controllers/gate.controller'

const router = Router()
router.use(verifyToken)

// Búsqueda por código QR

router.post('/generate-codes', generateAttendanceCodes)
router.get('/attendance-codes', getAttendanceCodes)
router.get('/teacher/:code',            getTeacherByCode)
router.get('/staff/:code',              getStaffByCode)
router.post('/regenerate-code/:type/:id', regenerateCode)

// Lista esperados hoy
router.get('/expected-today',           getExpectedToday)

// Registros
router.post('/teacher',                 registerTeacher)
router.post('/staff',                   registerStaff)
router.post('/visitor',                 registerVisitor)
router.post('/mark-absent',             markAbsentTeachers)

// Historial
router.get('/records',                  getRecords)
router.get('/records/today-teachers',   getTodayTeachers)

export default router
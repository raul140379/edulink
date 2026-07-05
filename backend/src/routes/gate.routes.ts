import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  registerStudentSchema, registerTeacherSchema, registerStaffSchema, registerVisitorSchema,
} from '../schemas/gate.schema'
import {
  getTeacherByCode,
  getStaffByCode,
  getStudentByCode,
  registerStudent,
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

// Gestión de códigos de asistencia (solo Director)
router.post('/generate-codes',            requirePermission(Permission.GATE_CODES_MANAGE), generateAttendanceCodes)
router.get('/attendance-codes',           requirePermission(Permission.GATE_CODES_MANAGE), getAttendanceCodes)
router.post('/regenerate-code/:type/:id', requirePermission(Permission.GATE_CODES_MANAGE), regenerateCode)

// Búsqueda por código QR
router.get('/teacher/:code', requirePermission(Permission.GATE_VIEW), getTeacherByCode)
router.get('/staff/:code',   requirePermission(Permission.GATE_VIEW), getStaffByCode)
router.get('/student/:code', requirePermission(Permission.STUDENT_VERIFY), getStudentByCode)
router.post('/student',      requirePermission(Permission.GATE_REGISTER), validateBody(registerStudentSchema), registerStudent)

// Lista esperados hoy
router.get('/expected-today', requirePermission(Permission.GATE_VIEW), getExpectedToday)

// Registros
router.post('/teacher', requirePermission(Permission.GATE_REGISTER), validateBody(registerTeacherSchema), registerTeacher)
router.post('/staff',   requirePermission(Permission.GATE_REGISTER), validateBody(registerStaffSchema), registerStaff)
router.post('/visitor', requirePermission(Permission.GATE_REGISTER), validateBody(registerVisitorSchema), registerVisitor)
router.post('/mark-absent', requirePermission(Permission.GATE_REGISTER), markAbsentTeachers)

// Historial
router.get('/records',                requirePermission(Permission.GATE_VIEW), getRecords)
router.get('/records/today-teachers', requirePermission(Permission.GATE_VIEW), getTodayTeachers)

export default router

import { Router } from 'express'
import {
  getAcademicYears,
  getActiveYear,
  createAcademicYear,
  updateAcademicYear,
  toggleAcademicYear,
  createTrimester,
  getTrimesters,
  createHoliday,
  getHolidays,
  deleteHoliday,
  toggleCloseTrimester,
} from '../controllers/academic.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createAcademicYearSchema, updateAcademicYearSchema, createTrimesterSchema, createHolidaySchema } from '../schemas/academic.schema'

const router = Router()

router.use(verifyToken)

// Gestiones
router.get('/',              requirePermission(Permission.ACADEMIC_VIEW), getAcademicYears)
router.get('/active',        requirePermission(Permission.ACADEMIC_VIEW), getActiveYear)
router.post('/',             requirePermission(Permission.ACADEMIC_MANAGE), validateBody(createAcademicYearSchema), createAcademicYear)
router.put('/:id',           requirePermission(Permission.ACADEMIC_MANAGE), validateBody(updateAcademicYearSchema), updateAcademicYear)
router.patch('/:id/toggle',  requirePermission(Permission.ACADEMIC_MANAGE), toggleAcademicYear)

// Trimestres
router.get('/:yearId/trimesters',                    requirePermission(Permission.ACADEMIC_VIEW), getTrimesters)
router.post('/:yearId/trimesters',                   requirePermission(Permission.ACADEMIC_MANAGE), validateBody(createTrimesterSchema), createTrimester)
router.patch('/:yearId/trimesters/:id/toggle-close', requirePermission(Permission.ACADEMIC_TRIMESTER_CLOSE), toggleCloseTrimester)

// Feriados
router.get('/:yearId/holidays',          requirePermission(Permission.ACADEMIC_VIEW), getHolidays)
router.post('/:yearId/holidays',         requirePermission(Permission.ACADEMIC_MANAGE), validateBody(createHolidaySchema), createHoliday)
router.delete('/:yearId/holidays/:id',   requirePermission(Permission.ACADEMIC_MANAGE), deleteHoliday)

export default router

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
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

// Gestiones
router.get('/',              getAcademicYears)
router.get('/active',        getActiveYear)
router.post('/',             requirePermission(Permission.USER_CREATE), createAcademicYear)
router.put('/:id',           requirePermission(Permission.USER_CREATE), updateAcademicYear)
router.patch('/:id/toggle',  requirePermission(Permission.USER_CREATE), toggleAcademicYear)

// Trimestres
router.get('/:yearId/trimesters',                       getTrimesters)
router.post('/:yearId/trimesters',                      requirePermission(Permission.USER_CREATE), createTrimester)
router.patch('/:yearId/trimesters/:id/toggle-close',    requirePermission(Permission.USER_CREATE), toggleCloseTrimester)

// Feriados
router.get('/:yearId/holidays',          getHolidays)
router.post('/:yearId/holidays',         requirePermission(Permission.USER_CREATE), createHoliday)
router.delete('/:yearId/holidays/:id',   requirePermission(Permission.USER_CREATE), deleteHoliday)

export default router
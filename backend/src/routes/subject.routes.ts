import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  createSubjectSchema, updateSubjectSchema, assignSubjectSchema,
  assignSubjectBulkSchema, addGradeConfigSchema, updateGradeConfigSchema,
} from '../schemas/subject.schema'
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjectToCourse,
  removeSubjectFromCourse,
  getCoursePlan,
  addSubjectToGradePlan,
  removeSubjectFromGradePlan,
  assignSubjectToMultipleCourses,
  getOccupiedCoursesForSubject,
  updateSubjectGradeConfig,
  getSubjectGradeConfigs,
} from '../controllers/subject.controller'

const router = Router()

router.use(verifyToken)

// ⚠️ Rutas específicas PRIMERO (antes de /:id para evitar conflicto)
router.get('/plan/:courseId', requirePermission(Permission.COURSE_VIEW_ALL), getCoursePlan)
router.post('/assign',        requirePermission(Permission.COURSE_CREATE), validateBody(assignSubjectSchema), assignSubjectToCourse)
router.post('/assign-bulk',   requirePermission(Permission.COURSE_CREATE), validateBody(assignSubjectBulkSchema), assignSubjectToMultipleCourses)
router.delete('/assign/:id',  requirePermission(Permission.COURSE_CREATE), removeSubjectFromCourse)
router.post('/grade-config', requirePermission(Permission.COURSE_CREATE), validateBody(addGradeConfigSchema), addSubjectToGradePlan)
router.delete('/grade-config/:id', requirePermission(Permission.COURSE_CREATE), removeSubjectFromGradePlan)
router.get('/:id/occupied-courses', requirePermission(Permission.COURSE_VIEW_ALL), getOccupiedCoursesForSubject)
router.put('/grade-config/:id', requirePermission(Permission.COURSE_CREATE), validateBody(updateGradeConfigSchema), updateSubjectGradeConfig)
router.get('/:id/grade-configs', requirePermission(Permission.COURSE_VIEW_ALL), getSubjectGradeConfigs)
// Rutas genéricas DESPUÉS
router.get('/',       requirePermission(Permission.COURSE_VIEW_ALL), getSubjects)
router.post('/',      requirePermission(Permission.COURSE_CREATE), validateBody(createSubjectSchema), createSubject)
router.put('/:id',    requirePermission(Permission.COURSE_CREATE), validateBody(updateSubjectSchema), updateSubject)
router.delete('/:id', requirePermission(Permission.COURSE_CREATE), deleteSubject)

export default router
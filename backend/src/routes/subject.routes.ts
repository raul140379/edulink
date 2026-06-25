import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
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
router.get('/plan/:courseId', getCoursePlan)
router.post('/assign',        assignSubjectToCourse)
router.post('/assign-bulk',   assignSubjectToMultipleCourses)
router.delete('/assign/:id',  removeSubjectFromCourse)
router.post('/grade-config', addSubjectToGradePlan)
router.delete('/grade-config/:id', removeSubjectFromGradePlan)
router.get('/:id/occupied-courses', getOccupiedCoursesForSubject)
router.put('/grade-config/:id', updateSubjectGradeConfig)
router.get('/:id/grade-configs', getSubjectGradeConfigs)
// Rutas genéricas DESPUÉS
router.get('/',       getSubjects)
router.post('/',      createSubject)
router.put('/:id',    updateSubject)
router.delete('/:id', deleteSubject)

export default router
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
} from '../controllers/subject.controller'

const router = Router()

router.use(verifyToken)

// ⚠️ Rutas específicas PRIMERO (antes de /:id para evitar conflicto)
router.get('/plan/:courseId', getCoursePlan)
router.post('/assign',        assignSubjectToCourse)
router.delete('/assign/:id',  removeSubjectFromCourse)

// Rutas genéricas DESPUÉS
router.get('/',       getSubjects)
router.post('/',      createSubject)
router.put('/:id',    updateSubject)
router.delete('/:id', deleteSubject)

export default router
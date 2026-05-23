import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjectToCourse,
  removeSubjectFromCourse,
} from '../controllers/subject.controller'

const router = Router()

router.use(verifyToken)

router.get('/',              getSubjects)
router.post('/',             createSubject)
router.put('/:id',           updateSubject)
router.delete('/:id',        deleteSubject)
router.post('/assign',       assignSubjectToCourse)
router.delete('/assign/:id', removeSubjectFromCourse)

export default router
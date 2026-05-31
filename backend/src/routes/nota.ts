import { Router } from 'express'
import {
  getTrimestres,
  getNotasByCourse,
  getNotasByStudent,
  upsertNotasBulk,
  getCourseSummary,
  getTeacherSubjects,
  getCourseStudents,
} from '../controllers/nota'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'

const router = Router()

router.use(verifyToken)

router.get('/trimestres',                    getTrimestres)
router.get('/teacher-subjects/:teacherId',   getTeacherSubjects)
router.get('/course-students/:courseId',     getCourseStudents)
router.get('/course/:courseId',              getNotasByCourse)
router.get('/student/:studentId',            getNotasByStudent)
router.get('/summary/:courseId',             getCourseSummary)
router.post('/bulk',                         upsertNotasBulk)

export default router
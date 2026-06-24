import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getAttendanceByCourse,
  saveAttendance,
  getMyCourses,
  getStudentHistory,
    closeAttendance,
} from '../controllers/studentAttendance.controller'

const router = Router()
router.use(verifyToken)

router.get('/my-courses',              getMyCourses)
router.get('/course/:courseId',        getAttendanceByCourse)
router.post('/course/:courseId',       saveAttendance)
router.get('/history/:studentId',      getStudentHistory)
router.post('/course/:courseId/close', closeAttendance)

export default router
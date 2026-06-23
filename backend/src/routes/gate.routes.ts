import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getTeacherByCode,
  registerTeacher,
  registerVisitor,
  getRecords,
  getTodayTeachers,
} from '../controllers/gate.controller'

const router = Router()
router.use(verifyToken)

router.get('/teacher/:code',       getTeacherByCode)
router.post('/teacher',            registerTeacher)
router.post('/visitor',            registerVisitor)
router.get('/records',             getRecords)
router.get('/records/today-teachers', getTodayTeachers)

export default router
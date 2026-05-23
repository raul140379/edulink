import { Router } from 'express'
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  toggleTeacherStatus,
  deleteTeacher,
  getTeacherMyCourse,
} from '../controllers/teacher.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',           requirePermission(Permission.STUDENT_VIEW_ALL), getTeachers)
router.get('/my-course', getTeacherMyCourse)
router.get('/:id',        requirePermission(Permission.STUDENT_VIEW_ALL), getTeacherById)
router.post('/',          requirePermission(Permission.STUDENT_CREATE),   createTeacher)
router.put('/:id',        requirePermission(Permission.STUDENT_CREATE),   updateTeacher)
router.patch('/:id/toggle', requirePermission(Permission.STUDENT_CREATE), toggleTeacherStatus)
router.delete('/:id',    requirePermission(Permission.STUDENT_CREATE),   deleteTeacher)

export default router
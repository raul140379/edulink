import { Router } from 'express'
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStudents,
} from '../controllers/course.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',              requirePermission(Permission.COURSE_VIEW_ALL), getCourses)
router.get('/:id',           requirePermission(Permission.COURSE_VIEW_ALL), getCourseById)
router.get('/:id/students',  requirePermission(Permission.COURSE_VIEW_ALL), getCourseStudents)
router.post('/',             requirePermission(Permission.COURSE_CREATE),   createCourse)
router.put('/:id',           requirePermission(Permission.COURSE_CREATE),   updateCourse)
router.delete('/:id',        requirePermission(Permission.COURSE_CREATE),   deleteCourse)

export default router
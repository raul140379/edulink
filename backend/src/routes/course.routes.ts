import { Router } from 'express'
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStudents,
  assignCourseTutor,
  removeCourseTutor,
  createDelegateUser,
  resetDelegatePassword,
  createTutorUser,
  resetTutorPassword,
} from '../controllers/course.controller'
import { verifyToken, requirePermission, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { createCourseSchema, updateCourseSchema, assignTutorSchema } from '../schemas/course.schema'
import { Permission, Role } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',                         requirePermission(Permission.COURSE_VIEW_ALL),              getCourses)
router.get('/:id',                      requirePermission(Permission.COURSE_VIEW_ALL),              getCourseById)
router.get('/:id/students',             requirePermission(Permission.COURSE_VIEW_ALL),              getCourseStudents)
router.post('/',                        requirePermission(Permission.COURSE_CREATE),                validateBody(createCourseSchema), createCourse)
router.put('/:id',                      requirePermission(Permission.COURSE_CREATE),                validateBody(updateCourseSchema), updateCourse)
router.delete('/:id',                   requirePermission(Permission.COURSE_CREATE),                deleteCourse)
router.post('/:id/assign-tutor',        requirePermission(Permission.COURSE_CREATE),               validateBody(assignTutorSchema), assignCourseTutor)
router.delete('/:id/assign-tutor',      requirePermission(Permission.COURSE_CREATE),               removeCourseTutor)
router.post('/:id/tutor-user',          requireRole(Role.DIRECTOR, Role.SUPER_ADMIN),              createTutorUser)
router.post('/:id/tutor-user/reset',    requireRole(Role.DIRECTOR, Role.SUPER_ADMIN),              resetTutorPassword)
router.post('/:id/delegate-user',       requireRole(Role.JUNTA_ESCOLAR, Role.SUPER_ADMIN),         createDelegateUser)
router.post('/:id/delegate-user/reset', requireRole(Role.JUNTA_ESCOLAR, Role.SUPER_ADMIN),         resetDelegatePassword)

export default router
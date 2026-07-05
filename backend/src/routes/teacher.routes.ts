import { Router } from 'express'
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  toggleTeacherStatus,
  deleteTeacher,
  getTeacherMyCourse,
  getTeacherWorkload,
  getTeacherWorkloadById, 
  setAttendanceCode,
  generateAttendanceCode_endpoint,
  setTeacherSchedule,
} from '../controllers/teacher.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { createTeacherSchema, updateTeacherSchema, attendanceCodeSchema, teacherScheduleSchema } from '../schemas/teacher.schema'
import { addTeacherSpecialtySchema } from '../schemas/teacherSpecialty.schema'
import { Permission } from '../config/permissions'
import {
  getTeacherSpecialties,
  addTeacherSpecialty,
  removeTeacherSpecialty
} from '../controllers/teacherSpecialty.controller'


const router = Router()

router.use(verifyToken)

router.get('/',                                   requirePermission(Permission.TEACHER_VIEW_ALL), getTeachers)
router.get('/my-course',                          getTeacherMyCourse)
router.get('/my-workload',                        getTeacherWorkload)
router.get('/:id/workload',                       requirePermission(Permission.TEACHER_VIEW_ALL),getTeacherWorkloadById);
router.get('/:id',                                requirePermission(Permission.TEACHER_VIEW_ALL), getTeacherById)
router.post('/',                                  requirePermission(Permission.TEACHER_CREATE),   validateBody(createTeacherSchema), createTeacher)
router.put('/:id',                                requirePermission(Permission.TEACHER_CREATE),   validateBody(updateTeacherSchema), updateTeacher)
router.patch('/:id/toggle',                       requirePermission(Permission.TEACHER_CREATE), toggleTeacherStatus)
router.patch('/:id/attendance-code', requirePermission(Permission.TEACHER_CREATE), validateBody(attendanceCodeSchema), setAttendanceCode)
router.delete('/:id',                             requirePermission(Permission.TEACHER_CREATE),   deleteTeacher)
router.get('/:id/specialties',                    requirePermission(Permission.TEACHER_VIEW_ALL), getTeacherSpecialties)
router.post('/:id/specialties',                   requirePermission(Permission.TEACHER_CREATE), validateBody(addTeacherSpecialtySchema), addTeacherSpecialty)
router.delete('/:id/specialties/:specialtyId',    requirePermission(Permission.TEACHER_CREATE), removeTeacherSpecialty)
router.post('/:id/generate-attendance-code', requirePermission(Permission.TEACHER_CREATE), generateAttendanceCode_endpoint)
router.patch('/:id/schedule', requirePermission(Permission.TEACHER_CREATE), validateBody(teacherScheduleSchema), setTeacherSchedule)

// GET /api/teachers?subjectId=5 — maestros con esa especialidad
export default router
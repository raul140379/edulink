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
} from '../controllers/teacher.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import {
  getTeacherSpecialties,
  addTeacherSpecialty,
  removeTeacherSpecialty
} from '../controllers/teacherSpecialty.controller'


const router = Router()

router.use(verifyToken)

router.get('/',                                   requirePermission(Permission.STUDENT_VIEW_ALL), getTeachers)
router.get('/my-course',                          getTeacherMyCourse)
router.get('/my-workload',                        getTeacherWorkload)
router.get('/:id/workload',                       requirePermission(Permission.STUDENT_VIEW_ALL),getTeacherWorkloadById);
router.get('/:id',                                requirePermission(Permission.STUDENT_VIEW_ALL), getTeacherById)
router.post('/',                                  requirePermission(Permission.STUDENT_CREATE),   createTeacher)
router.put('/:id',                                requirePermission(Permission.STUDENT_CREATE),   updateTeacher)
router.patch('/:id/toggle',                       requirePermission(Permission.STUDENT_CREATE), toggleTeacherStatus)
router.delete('/:id',                             requirePermission(Permission.STUDENT_CREATE),   deleteTeacher)
router.get('/:id/specialties',                    getTeacherSpecialties)
router.post('/:id/specialties',                   addTeacherSpecialty)
router.delete('/:id/specialties/:specialtyId',    removeTeacherSpecialty)

// GET /api/teachers?subjectId=5 — maestros con esa especialidad
export default router
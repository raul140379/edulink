import { Router } from 'express'
import {
  getStudents,
  getStudentById,
  getStudentEnrollments,
  createStudent,
  updateStudent,
  toggleStudentStatus,
  enrollStudent,
  deleteStudent,
  generateCredentials,
  importStudents,
  importTutors,
  getStudentsByCourse,
  changeEnrollment, 
  getMyProfile,
  getMyGrades,
  getMyTasks,
  getMyNotifications,
  markNotificationRead,
  getMySubjects,
  saveMyAutoEvaluacion,
  cancelEnrollment,
} from '../controllers/student.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import multer from 'multer'
const upload = multer({ storage: multer.memoryStorage() })

const router = Router()

router.use(verifyToken) 

// ── Rutas del estudiante autenticado (antes de /:id) ──
router.get('/me',                            getMyProfile)
router.get('/my-grades',                     getMyGrades)
router.get('/my-tasks',                      getMyTasks)
router.get('/my-notifications',              getMyNotifications)
router.patch('/my-notifications/:id/read',   markNotificationRead)
router.get('/my-subjects',                   getMySubjects)
router.put('/my-autoevaluacion',             saveMyAutoEvaluacion)

router.get('/',                              requirePermission(Permission.STUDENT_VIEW_ALL),  getStudents)
router.get('/:id',                           requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentById)
router.get('/:id/enrollments',               requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentEnrollments)
router.post('/',                             requirePermission(Permission.STUDENT_CREATE),    createStudent)
router.put('/:id',                           requirePermission(Permission.STUDENT_CREATE),    updateStudent)
router.patch('/:id/toggle',                  requirePermission(Permission.STUDENT_CREATE),    toggleStudentStatus)
router.post('/:id/enroll',                   requirePermission(Permission.ENROLLMENT_CREATE), enrollStudent)
router.delete('/:id',                        requirePermission(Permission.STUDENT_CREATE),    deleteStudent)
router.post('/:id/generate-credentials',     requirePermission(Permission.STUDENT_CREATE),    generateCredentials)
router.post('/import',                       upload.single('file'),                           importStudents)
router.post('/import-tutors',                upload.single('file'),                           importTutors)
router.get('/by-course/:courseId',           requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentsByCourse)
router.put('/:id/enroll',                    requirePermission(Permission.ENROLLMENT_CREATE), changeEnrollment)
router.delete('/:id/enroll',                  requirePermission(Permission.STUDENT_CREATE), cancelEnrollment)

export default router
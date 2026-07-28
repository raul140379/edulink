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
  getMyGamification,
  getMyAchievements,
  deliverTask,
} from '../controllers/student.controller'
import { verifyToken, requirePermission, requireAnyPermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { createStudentSchema, updateStudentSchema, enrollSchema, autoEvaluacionSchema } from '../schemas/student.schema'
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
router.put('/my-autoevaluacion',             validateBody(autoEvaluacionSchema), saveMyAutoEvaluacion)
router.get('/my-gamification',               getMyGamification)
router.get('/my-achievements',               getMyAchievements)
router.patch('/tasks/:submissionId/deliver', deliverTask)

// Nota: STUDENT_VIEW_BASIC (Junta de Núcleo/Distrito) también entra aquí — el
// servicio decide qué proyección de campos devolver según qué permiso realmente
// tenga el actor (ver studentService.listStudents/getStudentById).
router.get('/',                              requireAnyPermission(Permission.STUDENT_VIEW_ALL, Permission.STUDENT_VIEW_BASIC),  getStudents)
router.get('/:id',                           requireAnyPermission(Permission.STUDENT_VIEW_ALL, Permission.STUDENT_VIEW_BASIC),  getStudentById)
router.get('/:id/enrollments',               requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentEnrollments)
router.post('/',                             requirePermission(Permission.STUDENT_CREATE),    validateBody(createStudentSchema), createStudent)
router.put('/:id',                           requirePermission(Permission.STUDENT_CREATE),    validateBody(updateStudentSchema), updateStudent)
router.patch('/:id/toggle',                  requirePermission(Permission.STUDENT_CREATE),    toggleStudentStatus)
router.post('/:id/enroll',                   requirePermission(Permission.ENROLLMENT_CREATE), validateBody(enrollSchema), enrollStudent)
router.delete('/:id',                        requirePermission(Permission.STUDENT_CREATE),    deleteStudent)
router.post('/:id/generate-credentials',     requirePermission(Permission.STUDENT_CREATE),    generateCredentials)
router.post('/import',                       upload.single('file'),                           importStudents)
router.post('/import-tutors',                upload.single('file'),                           importTutors)
router.get('/by-course/:courseId',           requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentsByCourse)
router.put('/:id/enroll',                    requirePermission(Permission.ENROLLMENT_CREATE), changeEnrollment)
router.delete('/:id/enroll',                  requirePermission(Permission.STUDENT_CREATE), cancelEnrollment)

export default router
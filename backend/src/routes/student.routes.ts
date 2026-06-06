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
} from '../controllers/student.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'
import multer from 'multer'
const upload = multer({ storage: multer.memoryStorage() })

const router = Router()

router.use(verifyToken)

router.get('/',                           requirePermission(Permission.STUDENT_VIEW_ALL),  getStudents)
router.get('/:id',                        requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentById)
router.get('/:id/enrollments',            requirePermission(Permission.STUDENT_VIEW_ALL),  getStudentEnrollments)
router.post('/',                          requirePermission(Permission.STUDENT_CREATE),    createStudent)
router.put('/:id',                        requirePermission(Permission.STUDENT_CREATE),    updateStudent)
router.patch('/:id/toggle',              requirePermission(Permission.STUDENT_CREATE),    toggleStudentStatus)
router.post('/:id/enroll',               requirePermission(Permission.ENROLLMENT_CREATE), enrollStudent)
router.delete('/:id',                    requirePermission(Permission.STUDENT_CREATE),    deleteStudent)
router.post('/:id/generate-credentials', requirePermission(Permission.STUDENT_CREATE),
generateCredentials)
router.post('/import', verifyToken, upload.single('file'), importStudents)
router.post('/import-tutors', verifyToken, upload.single('file'), importTutors)
router.get('/by-course/:courseId', requirePermission(Permission.STUDENT_VIEW_ALL), getStudentsByCourse)
router.put('/:id/enroll', requirePermission(Permission.ENROLLMENT_CREATE), changeEnrollment)
export default router
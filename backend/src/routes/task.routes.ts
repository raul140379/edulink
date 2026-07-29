import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createTaskSchema, updateTaskSchema, gradeSubmissionsSchema } from '../schemas/task.schema'
import {
  getTasksByCourse,
  getTasksByStudent,
  getMyTasks,
  getMyPendingGrading,
  createTask,
  updateTask,
  deleteTask,
  getTaskSubmissions,
  gradeSubmissions,
  getStudentTaskSummary,
} from '../controllers/task.controller'

const router = Router()

router.use(verifyToken)

// Rutas específicas primero
router.get('/my-tasks',                        getMyTasks)
router.get('/my-pending-review',               getMyPendingGrading)
router.get('/by-course/:courseId',             requirePermission(Permission.GRADE_VIEW_ALL), getTasksByCourse)
router.get('/by-student/:studentId',           requirePermission(Permission.GRADE_VIEW_ALL), getTasksByStudent)
router.get('/summary/by-student/:studentId',   requirePermission(Permission.GRADE_VIEW_ALL), getStudentTaskSummary)

// CRUD
router.post('/',                               requirePermission(Permission.GRADE_CREATE), validateBody(createTaskSchema), createTask)
router.put('/:id',                             requirePermission(Permission.GRADE_CREATE), validateBody(updateTaskSchema), updateTask)
router.delete('/:id',                          requirePermission(Permission.GRADE_CREATE), deleteTask)

// Calificaciones
router.get('/:id/submissions',                 requirePermission(Permission.GRADE_VIEW_ALL), getTaskSubmissions)
router.patch('/:id/submissions/bulk',          requirePermission(Permission.GRADE_CREATE), validateBody(gradeSubmissionsSchema), gradeSubmissions)

export default router
import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getTasksByCourse,
  getTasksByStudent,
  getMyTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskSubmissions,
  gradeSubmissions,
  getStudentTaskSummary,
  markDelivered,
} from '../controllers/task.controller'

const router = Router()

router.use(verifyToken)

// Rutas específicas primero
router.get('/my-tasks',                        getMyTasks)
router.get('/by-course/:courseId',             getTasksByCourse)
router.get('/by-student/:studentId',           getTasksByStudent)
router.get('/summary/by-student/:studentId',   getStudentTaskSummary)

// CRUD
router.post('/',                               createTask)
router.put('/:id',                             updateTask)
router.delete('/:id',                          deleteTask)

// Calificaciones
router.get('/:id/submissions',                 getTaskSubmissions)
router.patch('/:id/submissions/bulk',          gradeSubmissions)

// Estudiante marca entrega
router.patch('/submissions/:submissionId/mark-delivered', markDelivered)

export default router
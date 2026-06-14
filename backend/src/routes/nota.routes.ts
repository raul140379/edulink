import { Router } from 'express'
import {
  getTrimestres,
  getTeacherSubjects,
  getCourseStudents,
  getNotasByCourse,
  getNotasByStudent,
  getNotaDetalle,
  getCourseSummary,
  initNota,
  addNotaItem,
  updateNotaItem,
  deleteNotaItem,
  updateSer,
  updateAutoEvaluacion,
  cerrarNota,
  upsertNotasBulk,
} from '../controllers/nota.controller'
import { verifyToken } from '../middlewares/auth.middleware'

const router = Router()
router.use(verifyToken)

// Consultas
router.get('/trimestres',                    getTrimestres)
router.get('/teacher-subjects/:teacherId',   getTeacherSubjects)
router.get('/course-students/:courseId',     getCourseStudents)
router.get('/course/:courseId',              getNotasByCourse)
router.get('/student/:studentId',            getNotasByStudent)
router.get('/summary/:courseId',             getCourseSummary)
router.get('/detalle/:notaId',               getNotaDetalle)

// Gestión de notas
router.post('/init',                         initNota)
router.post('/items',                        addNotaItem)
router.put('/items/:id',                     updateNotaItem)
router.delete('/items/:id',                  deleteNotaItem)

// Dimensiones finales
router.put('/:id/ser',                       updateSer)
router.put('/:id/autoevaluacion',            updateAutoEvaluacion)
router.put('/:id/cerrar',                    cerrarNota)

// Deprecated
router.post('/bulk',                         upsertNotasBulk)

export default router
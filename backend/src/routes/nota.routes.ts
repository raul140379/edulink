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
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  initNotaSchema, addNotaItemSchema, updateNotaItemSchema, updateSerSchema, updateAutoEvaluacionSchema,
} from '../schemas/nota.schema'

const router = Router()
router.use(verifyToken)

// Consultas
router.get('/trimestres',                    requirePermission(Permission.GRADE_VIEW_ALL), getTrimestres)
router.get('/teacher-subjects/:teacherId',   requirePermission(Permission.GRADE_VIEW_ALL), getTeacherSubjects)
router.get('/course-students/:courseId',     requirePermission(Permission.GRADE_VIEW_ALL), getCourseStudents)
router.get('/course/:courseId',              requirePermission(Permission.GRADE_VIEW_ALL), getNotasByCourse)
router.get('/student/:studentId',            requirePermission(Permission.GRADE_VIEW_ALL), getNotasByStudent)
router.get('/summary/:courseId',             requirePermission(Permission.GRADE_VIEW_ALL), getCourseSummary)
router.get('/detalle/:notaId',               requirePermission(Permission.GRADE_VIEW_ALL), getNotaDetalle)

// Gestión de notas
router.post('/init',                         requirePermission(Permission.GRADE_CREATE), validateBody(initNotaSchema), initNota)
router.post('/items',                        requirePermission(Permission.GRADE_CREATE), validateBody(addNotaItemSchema), addNotaItem)
router.put('/items/:id',                     requirePermission(Permission.GRADE_CREATE), validateBody(updateNotaItemSchema), updateNotaItem)
router.delete('/items/:id',                  requirePermission(Permission.GRADE_CREATE), deleteNotaItem)

// Dimensiones finales
router.put('/:id/ser',                       requirePermission(Permission.GRADE_CREATE), validateBody(updateSerSchema), updateSer)
router.put('/:id/autoevaluacion',            requirePermission(Permission.GRADE_CREATE), validateBody(updateAutoEvaluacionSchema), updateAutoEvaluacion)
router.put('/:id/cerrar',                    requirePermission(Permission.GRADE_CREATE), cerrarNota)

// Deprecated
router.post('/bulk',                         upsertNotasBulk)

export default router
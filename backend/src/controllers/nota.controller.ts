import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { HttpError } from '../utils/http-error'
import { hasPermission, Permission } from '../config/permissions'
import { assertOwnStudent } from '../utils/ownership-guards'
import { notaService } from '../services/nota.service'

// El frontend de notas (dashboard/teacher/notas) lee específicamente `data.error`,
// no `data.message` como el resto de la app — se mantiene esa forma de respuesta aquí.
const handleControllerError = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Error interno del servidor' })
}

// ─────────────────────────────────────────────
// GET /notas/trimestres?year=2026
// ─────────────────────────────────────────────
export const getTrimestres = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    res.json(await notaService.getTrimestres(year))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /notas/teacher-subjects/:teacherId
// ─────────────────────────────────────────────
export const getTeacherSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notaService.getTeacherSubjects(parseInt(req.params.teacherId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /notas/course-students/:courseId?year=2026
// ─────────────────────────────────────────────
export const getCourseStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    res.json(await notaService.getCourseStudents(parseInt(req.params.courseId), year))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /notas/course/:courseId?trimesterId=1&year=2026
// ─────────────────────────────────────────────
export const getNotasByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trimesterId = req.query.trimesterId ? parseInt(req.query.trimesterId as string) : undefined
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    res.json(await notaService.getNotasByCourse(parseInt(req.params.courseId), trimesterId, year))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /notas/student/:studentId?year=2026
// ─────────────────────────────────────────────
export const getNotasByStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId)
    if (!hasPermission(req.userRole!, Permission.GRADE_VIEW_ALL)) {
      await assertOwnStudent(req, studentId)
    }
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    res.json(await notaService.getNotasByStudent(studentId, year))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /notas/detalle/:notaId
// ─────────────────────────────────────────────
export const getNotaDetalle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notaService.getNotaDetalle(parseInt(req.params.notaId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /notas/init
// ─────────────────────────────────────────────
export const initNota = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notaService.initNota(req.body))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /notas/items
// ─────────────────────────────────────────────
export const addNotaItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await notaService.addNotaItem(req.body)
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /notas/items/:id
// ─────────────────────────────────────────────
export const updateNotaItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nota = await notaService.updateNotaItem(parseInt(req.params.id), req.body)
    res.json({ message: 'Ítem actualizado', nota })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /notas/items/:id
// ─────────────────────────────────────────────
export const deleteNotaItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nota = await notaService.deleteNotaItem(parseInt(req.params.id))
    res.json({ message: 'Ítem eliminado', nota })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /notas/:id/ser
// ─────────────────────────────────────────────
export const updateSer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notaService.updateSer(parseInt(req.params.id), req.body))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /notas/:id/autoevaluacion
// ─────────────────────────────────────────────
export const updateAutoEvaluacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notaService.updateAutoEvaluacion(parseInt(req.params.id), req.body))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /notas/:id/cerrar
// ─────────────────────────────────────────────
export const cerrarNota = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nota = await notaService.cerrarNota(parseInt(req.params.id))
    res.json({ message: 'Trimestre cerrado correctamente', nota })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /notas/summary/:courseId?year=2026
// ─────────────────────────────────────────────
export const getCourseSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    res.json(await notaService.getCourseSummary(parseInt(req.params.courseId), year))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /notas/bulk — deprecated
// ─────────────────────────────────────────────
export const upsertNotasBulk = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(410).json({ error: 'Este endpoint fue reemplazado. Usar POST /notas/init + POST /notas/items' })
}

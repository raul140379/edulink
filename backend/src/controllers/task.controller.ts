import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { taskService } from '../services/task.service'

// ─────────────────────────────────────────────
// GET /api/tasks/by-course/:courseId
// ─────────────────────────────────────────────
export const getTasksByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, trimesterId } = req.query
    const tasks = await taskService.getTasksByCourse(
      parseInt(req.params.courseId), subjectId as string | undefined, trimesterId as string | undefined
    )
    res.json(tasks)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/by-student/:studentId
// ─────────────────────────────────────────────
export const getTasksByStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, trimesterId } = req.query
    const tasks = await taskService.getTasksByStudent(
      parseInt(req.params.studentId), subjectId as string | undefined, trimesterId as string | undefined
    )
    res.json(tasks)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/my-tasks
// ─────────────────────────────────────────────
export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await taskService.getMyTasks(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/tasks
// ─────────────────────────────────────────────
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { task, assignedCount } = await taskService.createTask(req.userId, req.body)
    res.status(201).json({ message: `Tarea creada y asignada a ${assignedCount} estudiante(s)`, task })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/tasks/:id
// ─────────────────────────────────────────────
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await taskService.updateTask(parseInt(req.params.id), req.body)
    res.json({ message: 'Tarea actualizada', task })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await taskService.deleteTask(parseInt(req.params.id))
    res.json({ message: 'Tarea eliminada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/:id/submissions
// ─────────────────────────────────────────────
export const getTaskSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await taskService.getTaskSubmissions(parseInt(req.params.id)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/tasks/:id/submissions/bulk
// ─────────────────────────────────────────────
export const gradeSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await taskService.gradeSubmissions(parseInt(req.params.id), req.body)
    res.json({ message: 'Calificaciones guardadas y notas actualizadas' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/tasks/submissions/:submissionId/mark-delivered
// ─────────────────────────────────────────────
export const markDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await taskService.markDelivered(req.userId, parseInt(req.params.submissionId))
    res.json({ message: 'Tarea marcada como entregada', submission })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/summary/by-student/:studentId
// ─────────────────────────────────────────────
export const getStudentTaskSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const summary = await taskService.getStudentTaskSummary(parseInt(req.params.studentId), req.query.trimesterId as string | undefined)
    res.json(summary)
  } catch (error) {
    handleControllerError(res, error)
  }
}

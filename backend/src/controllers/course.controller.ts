import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { courseService } from '../services/course.service'

// ─────────────────────────────────────────────
// GET /api/courses
// ─────────────────────────────────────────────
export const getCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, shift, educationType } = req.query
    const courses = await courseService.listCourses(
      level as string | undefined, shift as string | undefined, educationType as string | undefined
    )
    res.json(courses)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/courses/:id
// ─────────────────────────────────────────────
export const getCourseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = await courseService.getCourseById(parseInt(req.params.id))
    res.json(course)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/courses/:id/students
// ─────────────────────────────────────────────
export const getCourseStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignments = await courseService.getCourseStudents(parseInt(req.params.id), req.query.year as string | undefined)
    res.json(assignments)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/courses
// ─────────────────────────────────────────────
export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = await courseService.createCourse(req.body)
    res.status(201).json({ message: 'Curso creado correctamente', course })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/courses/:id
// ─────────────────────────────────────────────
export const updateCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = await courseService.updateCourse(parseInt(req.params.id), req.body)
    res.json({ message: 'Curso actualizado correctamente', course })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/courses/:id
// ─────────────────────────────────────────────
export const deleteCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await courseService.deleteCourse(parseInt(req.params.id))
    res.json({ message: 'Curso eliminado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/courses/:id/assign-tutor
// ─────────────────────────────────────────────
export const assignCourseTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await courseService.assignTutor(parseInt(req.params.id), req.body)
    res.json({ message })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/courses/:id/assign-tutor
// ─────────────────────────────────────────────
export const removeCourseTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await courseService.removeTutor(parseInt(req.params.id))
    res.json({ message: 'Maestro tutor removido correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/courses/:id/delegate-user
// ─────────────────────────────────────────────
export const createDelegateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await courseService.createDelegateUser(parseInt(req.params.id))
    res.status(201).json({ message: 'Usuario delegado creado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/courses/:id/delegate-user/reset
// ─────────────────────────────────────────────
export const resetDelegatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await courseService.resetDelegatePassword(parseInt(req.params.id))
    res.json({ message: 'Contraseña reseteada correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/courses/:id/tutor-user
// ─────────────────────────────────────────────
export const createTutorUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await courseService.createTutorUser(parseInt(req.params.id))
    res.status(201).json({ message: 'Usuario tutor creado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/courses/:id/tutor-user/reset
// ─────────────────────────────────────────────
export const resetTutorPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await courseService.resetTutorPassword(parseInt(req.params.id))
    res.json({ message: 'Contraseña reseteada correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

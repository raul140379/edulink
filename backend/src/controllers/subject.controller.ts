import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { subjectService } from '../services/subject.service'

// ─────────────────────────────────────────────
// GET /api/subjects
// ─────────────────────────────────────────────
export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, grade } = req.query
    const subjects = await subjectService.listSubjects(level as string | undefined, grade as string | undefined)
    res.json(subjects)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/subjects/plan/:courseId
// ─────────────────────────────────────────────
export const getCoursePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await subjectService.getCoursePlan(parseInt(req.params.courseId))
    res.json(plan)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects
// ─────────────────────────────────────────────
export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await subjectService.createSubject(req.body)
    res.status(201).json({ message: 'Materia creada correctamente', subject })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/subjects/:id
// ─────────────────────────────────────────────
export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await subjectService.updateSubject(parseInt(req.params.id), req.body)
    res.json({ message: 'Materia actualizada correctamente', subject })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/:id
// ─────────────────────────────────────────────
export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await subjectService.deleteSubject(parseInt(req.params.id))
    res.json({ message: 'Materia eliminada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects/assign
// ─────────────────────────────────────────────
export const assignSubjectToCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignment, updated } = await subjectService.assignSubjectToCourse(req.body)
    if (updated) {
      res.json({ message: 'Maestro actualizado correctamente', assignment })
    } else {
      res.status(201).json({ message: 'Materia asignada correctamente', assignment })
    }
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/assign/:id
// ─────────────────────────────────────────────
export const removeSubjectFromCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await subjectService.removeSubjectFromCourse(parseInt(req.params.id))
    res.json({ message: 'Asignación eliminada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects/grade-config
// ─────────────────────────────────────────────
export const addSubjectToGradePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const config = await subjectService.addToGradePlan(req.body)
    res.status(201).json({ message: 'Materia agregada al plan correctamente', config })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/grade-config/:id
// ─────────────────────────────────────────────
export const removeSubjectFromGradePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await subjectService.removeFromGradePlan(parseInt(req.params.id))
    res.json({ message: 'Materia eliminada del plan correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects/assign-bulk
// ─────────────────────────────────────────────
export const assignSubjectToMultipleCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assigned, skipped } = await subjectService.assignSubjectToMultipleCourses(req.body)
    res.status(201).json({
      message: `${assigned.length} curso(s) asignado(s)${skipped.length ? `, ${skipped.length} omitido(s)` : ''}`,
      assigned, skipped,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/subjects/:id/occupied-courses
// ─────────────────────────────────────────────
export const getOccupiedCoursesForSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignments = await subjectService.getOccupiedCourses(parseInt(req.params.id))
    res.json(assignments)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/subjects/grade-config/:id
// ─────────────────────────────────────────────
export const updateSubjectGradeConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const config = await subjectService.updateGradeConfigHours(parseInt(req.params.id), req.body.hoursPerWeek)
    res.json({ message: 'Horas actualizadas correctamente', config })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/subjects/:id/grade-configs
// ─────────────────────────────────────────────
export const getSubjectGradeConfigs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const configs = await subjectService.getGradeConfigs(parseInt(req.params.id))
    res.json(configs)
  } catch (error) {
    handleControllerError(res, error)
  }
}

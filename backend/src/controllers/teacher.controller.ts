import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { teacherService } from '../services/teacher.service'

// ─────────────────────────────────────────────
// GET /api/teachers
// ─────────────────────────────────────────────
export const getTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive, subjectId, campo } = req.query
    const teachers = await teacherService.listTeachers(
      search as string | undefined, isActive as string | undefined,
      subjectId as string | undefined, campo as string | undefined
    )
    res.json(teachers)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teachers/:id
// ─────────────────────────────────────────────
export const getTeacherById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await teacherService.getTeacherById(parseInt(req.params.id))
    res.json(teacher)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teachers/:id/workload
// ─────────────────────────────────────────────
export const getTeacherWorkloadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workload = await teacherService.getWorkloadById(parseInt(req.params.id))
    res.json(workload)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teachers/my-workload
// ─────────────────────────────────────────────
export const getTeacherWorkload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workload = await teacherService.getMyWorkload(req.userId)
    res.json(workload)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/teachers
// ─────────────────────────────────────────────
export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await teacherService.createTeacher(req.body)
    res.status(201).json({ message: 'Maestro registrado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/teachers/:id
// ─────────────────────────────────────────────
export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await teacherService.updateTeacher(parseInt(req.params.id), req.body)
    res.json({ message: 'Maestro actualizado correctamente', teacher })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teachers/:id/toggle
// ─────────────────────────────────────────────
export const toggleTeacherStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const newStatus = await teacherService.toggleTeacherStatus(parseInt(req.params.id))
    res.json({ message: newStatus ? 'Maestro activado' : 'Maestro desactivado' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/teachers/:id
// ─────────────────────────────────────────────
export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await teacherService.deleteTeacher(parseInt(req.params.id))
    res.json({ message: 'Maestro eliminado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/teachers/my-course
// ─────────────────────────────────────────────
export const getTeacherMyCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = await teacherService.getMyCourse(req.userId)
    res.json(course)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teachers/:id/attendance-code
// ─────────────────────────────────────────────
export const setAttendanceCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await teacherService.setAttendanceCode(parseInt(req.params.id), req.body)
    res.json({ message: 'Código asignado correctamente', teacher })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/teachers/:id/generate-attendance-code
// ─────────────────────────────────────────────
export const generateAttendanceCode_endpoint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await teacherService.generateAttendanceCode(parseInt(req.params.id))
    res.json({ message: 'Código generado correctamente', teacher })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teachers/:id/schedule
// ─────────────────────────────────────────────
export const setTeacherSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await teacherService.setTeacherSchedule(parseInt(req.params.id), req.body)
    res.json({ message: 'Horario actualizado correctamente', teacher })
  } catch (error) {
    handleControllerError(res, error)
  }
}

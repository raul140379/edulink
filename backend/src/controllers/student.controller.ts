import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { studentService } from '../services/student.service'
import { parsePagination } from '../utils/pagination'

// ─────────────────────────────────────────────
// GET /api/students
// ─────────────────────────────────────────────
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive, page, pageSize, gender, courseId } = req.query
    const students = await studentService.listStudents(
      search as string | undefined, isActive as string | undefined,
      parsePagination(page as string | undefined, pageSize as string | undefined),
      gender as string | undefined,
      courseId ? parseInt(courseId as string) : undefined,
    )
    res.json(students)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/students/:id
// ─────────────────────────────────────────────
export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await studentService.getStudentById(parseInt(req.params.id))
    res.json(student)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/students/:id/enrollments
// ─────────────────────────────────────────────
export const getStudentEnrollments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enrollments = await studentService.getStudentEnrollments(parseInt(req.params.id))
    res.json(enrollments)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/students
// ─────────────────────────────────────────────
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentService.createStudent(req.body)
    res.status(201).json({ message: 'Estudiante registrado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/students/:id
// ─────────────────────────────────────────────
export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await studentService.updateStudent(parseInt(req.params.id), req.body)
    res.json({ message: 'Estudiante actualizado correctamente', student })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/students/:id/toggle
// ─────────────────────────────────────────────
export const toggleStudentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await studentService.toggleStudentStatus(parseInt(req.params.id))
    res.json({ message: student.isActive ? 'Estudiante activado' : 'Estudiante desactivado', student })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/students/:id
// ─────────────────────────────────────────────
export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await studentService.deleteStudent(parseInt(req.params.id))
    res.json({ message: 'Estudiante eliminado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/students/:id/generate-credentials
// ─────────────────────────────────────────────
export const generateCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await studentService.generateCredentials(parseInt(req.params.id))
    res.json({ message: 'Credenciales generadas correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/students/:id/enroll
// ─────────────────────────────────────────────
export const enrollStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { enrollment, year } = await studentService.enrollStudent(parseInt(req.params.id), req.body)
    res.status(201).json({ message: `Estudiante inscrito en ${year} correctamente`, enrollment })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/students/:id/enroll — cambiar inscripción
// ─────────────────────────────────────────────
export const changeEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.body
    if (!courseId) { res.status(400).json({ message: 'El curso es requerido' }); return }
    const enrollment = await studentService.changeEnrollment(parseInt(req.params.id), parseInt(courseId))
    res.json({ message: 'Inscripción actualizada correctamente', enrollment })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/students/:id/enroll — anular inscripción
// ─────────────────────────────────────────────
export const cancelEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = await studentService.cancelEnrollment(parseInt(req.params.id))
    res.json({ message: `Inscripción anulada correctamente. El estudiante salió de ${course.grade} "${course.parallel}"` })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/students/by-course/:courseId
// ─────────────────────────────────────────────
export const getStudentsByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignments = await studentService.getStudentsByCourse(parseInt(req.params.courseId))
    res.json(assignments)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// Autoservicio del estudiante
// ─────────────────────────────────────────────
export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMyProfile(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMyGrades(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMyTasks(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMySubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMySubjects(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyGamification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMyGamification(req.userId, req.userRole as string))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyAchievements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMyAchievements(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const deliverTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.deliverTask(req.userId, parseInt(req.params.submissionId)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await studentService.getMyNotifications(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await studentService.markNotificationRead(req.userId, parseInt(req.params.id))
    res.json(updated)
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const saveMyAutoEvaluacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nota = await studentService.saveMyAutoEvaluacion(req.userId, req.body)
    res.json({ message: 'Autoevaluación guardada correctamente', nota })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// Importación masiva (Excel)
// ─────────────────────────────────────────────
export const importStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No se subió ningún archivo' }); return }
    const result = await studentService.importStudents(req.file.buffer)
    res.status(201).json({
      message: `Importación completada: ${result.created.length} creados, ${result.skipped.length} omitidos, ${result.errors.length} errores`,
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const importTutors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No se subió ningún archivo' }); return }
    const result = await studentService.importTutors(req.file.buffer)
    res.status(200).json({
      message: `Importación completada: ${result.assigned.length} tutores asignados, ${result.skipped.length} omitidos, ${result.errors.length} errores`,
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

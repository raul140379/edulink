import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { parentService } from '../services/parent.service'

// ─────────────────────────────────────────────
// GET /api/parents
// ─────────────────────────────────────────────
export const getParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive, isTutor } = req.query
    const parents = await parentService.listParents(
      search as string | undefined, isActive as string | undefined, isTutor as string | undefined
    )
    res.json(parents)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/:id
// ─────────────────────────────────────────────
export const getParentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await parentService.getParentById(parseInt(req.params.id))
    res.json(parent)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/:id/students
// ─────────────────────────────────────────────
export const getParentStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const relations = await parentService.getParentStudents(parseInt(req.params.id))
    res.json(relations)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents
// ─────────────────────────────────────────────
export const createParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.createParent(req.body)
    res.status(201).json({ message: 'Padre/tutor registrado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/parents/:id
// ─────────────────────────────────────────────
export const updateParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await parentService.updateParent(parseInt(req.params.id), req.body)
    res.json({ message: 'Padre/tutor actualizado correctamente', parent })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/parents/:id/toggle
// ─────────────────────────────────────────────
export const toggleParentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await parentService.toggleParentStatus(parseInt(req.params.id))
    res.json({ message: parent?.user?.isActive ? 'Tutor activado' : 'Tutor desactivado', parent })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/parents/:id
// ─────────────────────────────────────────────
export const deleteParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await parentService.deleteParent(parseInt(req.params.id))
    res.json({ message: 'Padre/tutor eliminado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/link-students
// ─────────────────────────────────────────────
export const linkStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const results = await parentService.linkStudents(parseInt(req.params.id), req.body)
    res.json({ message: `${results.length} estudiante(s) vinculado(s)`, relations: results })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/parents/:id/unlink/:studentId
// ─────────────────────────────────────────────
export const unlinkStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await parentService.unlinkStudent(parseInt(req.params.id), parseInt(req.params.studentId))
    res.json({ message: 'Estudiante desvinculado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/generate-credentials
// ─────────────────────────────────────────────
export const generateParentCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.generateCredentials(parseInt(req.params.id))
    res.json({ message: 'Credenciales generadas correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/regenerate-email
// ─────────────────────────────────────────────
export const regenerateParentEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.regenerateAccountEmail(parseInt(req.params.id))
    res.json({ message: 'Correo de acceso regenerado correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/parents/student/:id/change-tutor
// ─────────────────────────────────────────────
export const changeTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.changeTutor(parseInt(req.params.id), req.body)
    res.json({
      message: 'Tutor legal cambiado correctamente',
      ...(result.accessEmail ? { ...result, note: 'Se generaron credenciales para el nuevo tutor' } : {}),
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/parents/:id/change-relation/:studentId
// ─────────────────────────────────────────────
export const changeRelation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.changeRelation(parseInt(req.params.id), parseInt(req.params.studentId), req.body)
    res.json({ message: 'Relación actualizada correctamente', ...(result.accessEmail ? result : {}) })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// Autoservicio del padre
// ─────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await parentService.getMe(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await parentService.updateMe(req.userId, req.body)
    res.json({ message: 'Datos actualizados correctamente', parent })
  } catch (error) {
    handleControllerError(res, error)
  }
}

export const getMyStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await parentService.getMyStudents(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/attendance-codes
// ─────────────────────────────────────────────
export const getTutorAttendanceCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await parentService.getTutorAttendanceCodes())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/generate-codes
// ─────────────────────────────────────────────
export const generateTutorAttendanceCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await parentService.generateTutorAttendanceCodes())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/regenerate-code/:id
// ─────────────────────────────────────────────
export const regenerateTutorCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await parentService.regenerateTutorCode(parseInt(req.params.id)))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/reset-password
// ─────────────────────────────────────────────
export const resetTutorPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.resetTutorPassword(parseInt(req.params.id))
    res.json({ message: 'Contraseña reseteada correctamente', ...result })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/release-kardex
// ─────────────────────────────────────────────
export const releaseTutorKardex = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parentService.releaseTutorKardex(parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/registered-status
// ─────────────────────────────────────────────
export const getRegisteredStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await parentService.getAllWithStatus())
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/by-course
// ─────────────────────────────────────────────
export const getParentsByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const byCourse = await parentService.getParentsGroupedByCourse()
    res.json(byCourse)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/import
// ─────────────────────────────────────────────
export const importParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No se subió ningún archivo' }); return }
    const result = await parentService.importParents(req.file.buffer)
    res.status(201).json({
      message: `Importación completada: ${result.created.length} registros creados, ${result.skipped.length} omitidos, ${result.errors.length} errores`,
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

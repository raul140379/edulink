import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { userService } from '../services/user.service'
import { Role } from '@prisma/client'

// ─────────────────────────────────────────────
// GET /api/users — Listar todos los usuarios
// ─────────────────────────────────────────────
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, isActive, search } = req.query

    const users = await userService.listUsers({
      role:     role ? (role as Role) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search:   search ? (search as string) : undefined,
    })

    res.json(users)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/users/:id — Obtener un usuario
// ─────────────────────────────────────────────
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await userService.getUserById(parseInt(req.params.id))
    res.json(user)
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/users — Crear usuario
// ─────────────────────────────────────────────
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await userService.createUser(req.body)
    res.status(201).json({ message: 'Usuario creado correctamente', user })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PUT /api/users/:id — Actualizar usuario
// ─────────────────────────────────────────────
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await userService.updateUser(parseInt(req.params.id), req.body)
    res.json({ message: 'Usuario actualizado', user })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/users/:id/toggle — Activar/Desactivar
// ─────────────────────────────────────────────
export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await userService.toggleUserStatus(parseInt(req.params.id), req.userId as number)
    res.json({
      message: updated.isActive ? 'Usuario activado' : 'Usuario desactivado',
      user: updated,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/users/:id/reset-password
// ─────────────────────────────────────────────
export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await userService.resetPassword(parseInt(req.params.id))
    res.json({
      message: 'Contraseña restablecida correctamente',
      ...result,
    })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/users/reset-by-email
// ─────────────────────────────────────────────
export const resetByEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await userService.resetByEmail(req.body)
    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/users/:id
// ─────────────────────────────────────────────
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await userService.deleteUser(parseInt(req.params.id))
    res.json({ message: 'Usuario eliminado correctamente' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/users/junta-parents
// ─────────────────────────────────────────────
export const getJuntaParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parents = await userService.getJuntaParents()
    res.json(parents)
  } catch (error) {
    handleControllerError(res, error)
  }
}

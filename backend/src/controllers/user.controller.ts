import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/users — Listar todos los usuarios
// ─────────────────────────────────────────────
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, isActive, search } = req.query

    const users = await prisma.user.findMany({
      where: {
        ...(role     ? { role: role as any }           : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        ...(search   ? {
          OR: [
            { email: { contains: search as string, mode: 'insensitive' } },
            { parent:  { OR: [
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName:  { contains: search as string, mode: 'insensitive' } },
            ]}},
            { teacher: { OR: [
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName:  { contains: search as string, mode: 'insensitive' } },
            ]}},
            { student: { OR: [
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName:  { contains: search as string, mode: 'insensitive' } },
            ]}},
          ]
        } : {}),
      },
      select: {
        id:        true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        parent:  { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, ci: true } },
        student: { select: { id: true, firstName: true, lastName: true, rude: true } },
        staff:   { select: { id: true, firstName: true, lastName: true, staffRole: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(users)
  } catch (error) {
    console.error('getUsers error:', error)
    res.status(500).json({ message: 'Error al obtener usuarios' })
  }
}

// ─────────────────────────────────────────────
// GET /api/users/:id — Obtener un usuario
// ─────────────────────────────────────────────
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id:        true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        parent:  { select: { id: true, firstName: true, lastName: true, ci: true, phone: true, address: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, ci: true, specialty: true } },
        student: { select: { id: true, firstName: true, lastName: true, rude: true, ci: true } },
        staff:   { select: { id: true, firstName: true, lastName: true, staffRole: true } },
      },
    })

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    res.json(user)
  } catch (error) {
    console.error('getUserById error:', error)
    res.status(500).json({ message: 'Error al obtener usuario' })
  }
}

// ─────────────────────────────────────────────
// POST /api/users — Crear usuario
// ─────────────────────────────────────────────
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body

    if (!email || !password || !role) {
      res.status(400).json({ message: 'Email, contraseña y rol son requeridos' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ message: 'Ya existe un usuario con ese correo' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, role, isActive: true },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    })

    res.status(201).json({ message: 'Usuario creado correctamente', user })
  } catch (error) {
    console.error('createUser error:', error)
    res.status(500).json({ message: 'Error al crear usuario' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/users/:id — Actualizar usuario
// ─────────────────────────────────────────────
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { email, role, password } = req.body

    const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    const updateData: any = {}
    if (email)    updateData.email = email
    if (role)     updateData.role  = role
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data:  updateData,
      select: { id: true, email: true, role: true, isActive: true },
    })

    res.json({ message: 'Usuario actualizado', user })
  } catch (error) {
    console.error('updateUser error:', error)
    res.status(500).json({ message: 'Error al actualizar usuario' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/users/:id/toggle — Activar/Desactivar
// ─────────────────────────────────────────────
export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    if (user.id === req.userId) {
      res.status(400).json({ message: 'No puedes desactivar tu propio usuario' })
      return
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data:  { isActive: !user.isActive },
      select: { id: true, email: true, role: true, isActive: true },
    })

    res.json({
      message: updated.isActive ? 'Usuario activado' : 'Usuario desactivado',
      user: updated,
    })
  } catch (error) {
    console.error('toggleUserStatus error:', error)
    res.status(500).json({ message: 'Error al cambiar estado del usuario' })
  }
}

// ─────────────────────────────────────────────
// POST /api/users/:id/reset-password
// ─────────────────────────────────────────────
export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    // Generar nueva contraseña aleatoria
    const random      = Math.floor(100 + Math.random() * 900)
    const newPassword = `nnuu${new Date().getFullYear()}${random}`
    const hashed      = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: parseInt(id) },
      data:  { password: hashed }
    })

    res.json({
      message:     'Contraseña restablecida correctamente',
      newPassword,
      userEmail:   user.email,
    })
  } catch (error) {
    console.error('resetPassword error:', error)
    res.status(500).json({ message: 'Error al restablecer contraseña' })
  }
}
// POST /api/users/reset-by-email
export const resetByEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ message: 'Email y contraseña son requeridos' }); return
    }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(404).json({ message: 'Usuario no encontrado' }); return }
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { email }, data: { password: hashed } })
    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    res.status(500).json({ message: 'Error al resetear contraseña' })
  }
}

// DELETE /api/users/:id
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = parseInt(id)

    // Desvincular de parent, teacher, student, staff antes de eliminar
    await prisma.parent.updateMany({ where: { userId },        data: { userId: null } })
    await prisma.parent.updateMany({ where: { delegateUserId: userId }, data: { delegateUserId: null } })
    await prisma.teacher.updateMany({ where: { tutorUserId: userId }, data: { tutorUserId: null } })
    await prisma.student.updateMany({ where: { userId },       data: { userId: null } })

    await prisma.user.delete({ where: { id: userId } })
    res.json({ message: 'Usuario eliminado correctamente' })
  } catch (error) {
    console.error('deleteUser error:', error)
    res.status(500).json({ message: 'Error al eliminar usuario' })
  }
}
// GET /api/users/junta-parents
export const getJuntaParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const juntaUsers = await prisma.user.findMany({
      where: { role: 'JUNTA_ESCOLAR', isActive: true },
      select: {
        parent: { select: { id: true, firstName: true, lastName: true } }
      }
    })
    const parents = juntaUsers.map(u => u.parent).filter(p => p !== null)
    res.json(parents)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener junta escolar' })
  }
}
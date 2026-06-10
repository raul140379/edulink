import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth.middleware'
import { Role, ROLE_PERMISSIONS } from '../config/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'sgje_secret_key'

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ message: 'Email y contraseña son requeridos' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      res.status(401).json({ message: 'Credenciales incorrectas' })
      return
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      res.status(401).json({ message: 'Credenciales incorrectas' })
      return
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Usuario inactivo. Contacta al administrador.' })
      return
    }

    const permissions = ROLE_PERMISSIONS[user.role as Role] || []

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      user: {
        id:          user.id,
        email:       user.email,
        role:        user.role,
        permissions: permissions,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// ─────────────────────────────────────────────
// OBTENER USUARIO ACTUAL (GET /api/auth/me)
// ─────────────────────────────────────────────
export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id:       true,
        email:    true,
        role:     true,
        isActive: true,
        parent: {
          select: {
            id:        true,
            firstName: true,
            lastName:  true,
            phone:     true,
          }
        },
        teacher: {
          select: {
            id:        true,
            firstName: true,
            lastName:  true,
          }
        },
        teacherTutor: {
          select: {
            id:        true,
            firstName: true,
            lastName:  true,
          }
        },
        student: {
          select: {
            id:        true,
            firstName: true,
            lastName:  true,
            rude:      true,
          }
        },
        staff: {
          select: {
            id:        true,
            firstName: true,
            lastName:  true,
            staffRole: true,
          }
        },
      }
    })

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    const permissions = ROLE_PERMISSIONS[user.role as Role] || []

    res.json({ ...user, permissions })
  } catch (error) {
    console.error('Me error:', error)
    res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// ─────────────────────────────────────────────
// CAMBIAR CONTRASEÑA (PUT /api/auth/change-password)
// ─────────────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Contraseña actual y nueva son requeridas' })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      res.status(401).json({ message: 'Contraseña actual incorrecta' })
      return
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: req.userId },
      data:  { password: hashed },
    })

    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Error interno del servidor' })
  }
}
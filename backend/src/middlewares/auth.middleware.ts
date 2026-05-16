import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role, Permission, hasPermission } from '../config/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'sgje_secret_key'

// Extender el tipo Request para incluir datos del usuario
export interface AuthRequest extends Request {
  userId?:   number
  userRole?: Role
  userEmail?: string
}

// ─────────────────────────────────────────────
// MIDDLEWARE: Verificar token JWT
// ─────────────────────────────────────────────
export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Token requerido' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.userId    = decoded.id
    req.userRole  = decoded.role as Role
    req.userEmail = decoded.email
    next()
  } catch {
    res.status(403).json({ message: 'Token inválido o expirado' })
  }
}

// ─────────────────────────────────────────────
// MIDDLEWARE: Verificar permiso específico
// ─────────────────────────────────────────────
export const requirePermission = (permission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ message: 'No autenticado' })
      return
    }

    if (!hasPermission(req.userRole, permission)) {
      res.status(403).json({
        message: 'No tienes permiso para realizar esta acción',
        required: permission,
        role: req.userRole,
      })
      return
    }

    next()
  }
}

// ─────────────────────────────────────────────
// MIDDLEWARE: Verificar uno o más roles
// ─────────────────────────────────────────────
export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ message: 'No autenticado' })
      return
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({
        message: 'No tienes acceso a este recurso',
        required: roles,
        role: req.userRole,
      })
      return
    }

    next()
  }
}

// ─────────────────────────────────────────────
// MIDDLEWARE: Solo portero (verificación de entrada)
// ─────────────────────────────────────────────
export const requireStaff = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userRole) {
    res.status(401).json({ message: 'No autenticado' })
    return
  }

  const allowed: Role[] = [Role.SUPER_ADMIN, Role.DIRECTOR, Role.STAFF]

  if (!allowed.includes(req.userRole)) {
    res.status(403).json({ message: 'Acceso restringido al personal autorizado' })
    return
  }

  next()
}
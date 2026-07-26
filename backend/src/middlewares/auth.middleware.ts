import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role, Permission, hasPermission } from '../config/permissions'
import { env } from '../config/env'
import { runWithTenantContext } from '../lib/tenant-context'

// Extender el tipo Request para incluir datos del usuario
export interface AuthRequest extends Request {
  userId?:       number
  userRole?:     Role
  userEmail?:    string
  userSchoolId?:   number | null
  userDistrictId?: number | null
  userNucleoId?:   number | null
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
    const decoded = jwt.verify(token, env.jwtSecret) as any
    const schoolId:   number | null = decoded.schoolId ?? null
    const districtId: number | null = decoded.districtId ?? null
    const nucleoId:   number | null = decoded.nucleoId ?? null

    req.userId         = decoded.id
    req.userRole        = decoded.role as Role
    req.userEmail       = decoded.email
    req.userSchoolId    = schoolId
    req.userDistrictId  = districtId
    req.userNucleoId    = nucleoId

    runWithTenantContext(
      { userId: decoded.id, role: decoded.role, schoolId, districtId, nucleoId },
      next,
    )
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
// MIDDLEWARE: Verificar que tenga al menos uno de varios permisos
// (para rutas alcanzables tanto con el permiso ":all" de staff como
// con el ":own" de un padre/estudiante — el controller es responsable
// de verificar la propiedad real del recurso en ese segundo caso)
// ─────────────────────────────────────────────
export const requireAnyPermission = (...permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ message: 'No autenticado' })
      return
    }

    if (!permissions.some((p) => hasPermission(req.userRole!, p))) {
      res.status(403).json({
        message: 'No tienes permiso para realizar esta acción',
        required: permissions,
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

  const allowed: Role[] = [Role.SUPER_ADMIN, Role.DIRECTOR, Role.STAFF, Role.PORTERO]

  if (!allowed.includes(req.userRole)) {
    res.status(403).json({ message: 'Acceso restringido al personal autorizado' })
    return
  }

  next()
}
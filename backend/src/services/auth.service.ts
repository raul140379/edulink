import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { userRepository } from '../repositories/user.repository'
import { Role, ROLE_PERMISSIONS } from '../config/permissions'
import { env } from '../config/env'
import { LoginInput, ChangePasswordInput } from '../schemas/auth.schema'
import { HttpError } from '../utils/http-error'

export const authService = {
  async login({ email, password }: LoginInput) {
    const user = await userRepository.findByEmail(email)
    if (!user) throw new HttpError(401, 'Credenciales incorrectas')

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) throw new HttpError(401, 'Credenciales incorrectas')

    if (!user.isActive) throw new HttpError(403, 'Usuario inactivo. Contacta al administrador.')

    const permissions = ROLE_PERMISSIONS[user.role as Role] || []

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId, districtId: user.districtId },
      env.jwtSecret,
      { expiresIn: '8h' }
    )

    return {
      token,
      user: {
        id:    user.id,
        email: user.email,
        role:  user.role,
        permissions,
      },
    }
  },

  async getMe(userId: number) {
    const user = await userRepository.findByIdWithProfile(userId)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')

    const permissions = ROLE_PERMISSIONS[user.role as Role] || []
    return { ...user, permissions }
  },

  async changePassword(userId: number, { currentPassword, newPassword }: ChangePasswordInput) {
    const user = await userRepository.findById(userId)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) throw new HttpError(401, 'Contraseña actual incorrecta')

    const hashed = await bcrypt.hash(newPassword, 10)
    await userRepository.updatePassword(userId, hashed)
  },
}

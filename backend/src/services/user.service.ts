import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { userRepository, UserListFilters } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CreateUserInput, UpdateUserInput, ResetByEmailInput } from '../schemas/user.schema'

// Un DIRECTOR_DISTRITAL solo puede gestionar (editar/desactivar/resetear/eliminar)
// las cuentas que él mismo creó — ver a un Director de otro colegio en la lista no
// significa poder tocar su cuenta.
function assertManageableByDistrictDirector(user: { createdByUserId: number | null }) {
  const ctx = getTenantContext()
  if (ctx?.role === Role.DIRECTOR_DISTRITAL && user.createdByUserId !== ctx.userId) {
    throw new HttpError(403, 'Solo puedes gestionar los usuarios que vos mismo creaste')
  }
}

export const userService = {
  listUsers(filters: UserListFilters) {
    const ctx = getTenantContext()
    const scoped = ctx?.role === Role.DIRECTOR_DISTRITAL
      ? { ...filters, managementOrCreatedBy: ctx.userId }
      : filters
    return userRepository.findMany(scoped)
  },

  async getUserById(id: number) {
    const user = await userRepository.findByIdDetailed(id)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')
    return user
  },

  async createUser({ email, password, role, schoolId, districtId }: CreateUserInput) {
    const existing = await userRepository.findByEmail(email)
    if (existing) throw new HttpError(409, 'Ya existe un usuario con ese correo')

    const hashedPassword = await bcrypt.hash(password, 10)
    const createdByUserId = getTenantContext()?.userId
    return userRepository.create({ email, password: hashedPassword, role, schoolId, districtId, createdByUserId })
  },

  async updateUser(id: number, input: UpdateUserInput) {
    const existing = await userRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Usuario no encontrado')
    assertManageableByDistrictDirector(existing)

    const data: Partial<{ email: string; role: UpdateUserInput['role']; password: string }> = {}
    if (input.email)    data.email = input.email
    if (input.role)     data.role  = input.role
    if (input.password) data.password = await bcrypt.hash(input.password, 10)

    return userRepository.update(id, data)
  },

  async toggleUserStatus(id: number, requesterId: number) {
    const user = await userRepository.findById(id)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')
    assertManageableByDistrictDirector(user)

    if (user.id === requesterId) {
      throw new HttpError(400, 'No puedes desactivar tu propio usuario')
    }

    return userRepository.setActive(id, !user.isActive)
  },

  async resetPassword(id: number) {
    const user = await userRepository.findById(id)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')
    assertManageableByDistrictDirector(user)

    const random      = Math.floor(100 + Math.random() * 900)
    const newPassword = `nnuu${new Date().getFullYear()}${random}`
    const hashed       = await bcrypt.hash(newPassword, 10)

    await userRepository.update(id, { password: hashed })

    return { newPassword, userEmail: user.email }
  },

  async resetByEmail({ email, password }: ResetByEmailInput) {
    const user = await userRepository.findByEmail(email)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')

    const hashed = await bcrypt.hash(password, 10)
    await userRepository.updatePasswordByEmail(email, hashed)
  },

  async deleteUser(id: number) {
    const user = await userRepository.findById(id)
    if (!user) throw new HttpError(404, 'Usuario no encontrado')
    assertManageableByDistrictDirector(user)

    await userRepository.detachRelations(id)
    await userRepository.delete(id)
  },

  async getJuntaParents() {
    const juntaUsers = await userRepository.findJuntaParents()
    return juntaUsers.map((u) => u.parent).filter((p) => p !== null)
  },
}

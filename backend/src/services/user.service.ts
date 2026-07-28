import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { userRepository, UserListFilters } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CREATABLE_ROLES } from '../config/permissions'
import { DISTRICT_WIDE_ROLES, NUCLEO_WIDE_ROLES } from '../lib/scoped-models'
import prisma from '../lib/prisma'
import { CreateUserInput, UpdateUserInput, ResetByEmailInput } from '../schemas/user.schema'
import { generateUniqueEmail } from '../utils/account-generator'

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
  async generateEmail(firstName: string, lastName: string) {
    if (!firstName?.trim() || !lastName?.trim()) {
      throw new HttpError(400, 'Nombre y apellido son requeridos para generar el correo')
    }
    return generateUniqueEmail(firstName.trim(), lastName.trim())
  },

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

  async createUser({ email, password, role, schoolId, districtId, nucleoId }: CreateUserInput) {
    const existing = await userRepository.findByEmail(email)
    if (existing) throw new HttpError(409, 'Ya existe un usuario con ese correo')

    const ctx = getTenantContext()

    // Jerarquía de designación: SUPER_ADMIN sigue sin restricción; el resto solo
    // puede asignar los roles listados en CREATABLE_ROLES para su propio rol.
    if (ctx && ctx.role !== Role.SUPER_ADMIN) {
      const allowed = CREATABLE_ROLES[ctx.role]
      if (!allowed || !allowed.includes(role)) {
        throw new HttpError(403, `Tu rol no tiene permitido crear cuentas de tipo ${role}`)
      }
    }

    // El alcance (colegio/núcleo/distrito) de la cuenta nueva depende del ROL que
    // se le asigna, no del alcance de quien la crea (ver applyWriteScope en
    // lib/prisma.ts) — se resuelve y valida acá.
    let resolvedNucleoId   = nucleoId
    let resolvedDistrictId = districtId

    if (NUCLEO_WIDE_ROLES.has(role)) {
      if (nucleoId == null) throw new HttpError(400, 'Falta indicar el núcleo para este rol')
      if (ctx?.districtId != null) {
        const nucleo = await prisma.nucleo.findUnique({ where: { id: nucleoId }, select: { districtId: true } })
        if (!nucleo || nucleo.districtId !== ctx.districtId) {
          throw new HttpError(403, 'El núcleo indicado no pertenece a tu distrito')
        }
      }
      resolvedDistrictId = undefined
    } else if (DISTRICT_WIDE_ROLES.has(role)) {
      // Junta/Gobierno/Director Distrital: pertenece al mismo distrito de quien lo crea.
      resolvedDistrictId = ctx?.districtId ?? districtId
      resolvedNucleoId = undefined
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const createdByUserId = ctx?.userId
    return userRepository.create({
      email, password: hashedPassword, role, schoolId,
      districtId: resolvedDistrictId, nucleoId: resolvedNucleoId, createdByUserId,
    })
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
    const newPassword = `temp${new Date().getFullYear()}${random}`
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

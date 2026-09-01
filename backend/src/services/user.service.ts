import bcrypt from 'bcryptjs'
import { Role, StaffRole } from '@prisma/client'
import { userRepository, UserListFilters } from '../repositories/user.repository'
import { staffRepository } from '../repositories/staff.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CREATABLE_ROLES } from '../config/permissions'
import { DISTRICT_WIDE_ROLES, NUCLEO_WIDE_ROLES } from '../lib/scoped-models'
import prisma from '../lib/prisma'
import { CreateUserInput, UpdateUserInput, ResetByEmailInput } from '../schemas/user.schema'
import { generateUniqueEmail } from '../utils/account-generator'

// Roles que además de la cuenta de login necesitan quedar registrados en
// portería (control de ingreso/salida) — createUser crea el Staff
// correspondiente en la misma transacción que el User, para que no pueda
// pasar lo que pasaba antes: el User se crea pero el Staff se pierde en
// silencio (ver admin/portero/page.tsx, llamaba a un endpoint que no
// existía). DIRECTOR queda fuera a propósito — no pasa por control de acceso.
const STAFF_ROLE_BY_USER_ROLE: Partial<Record<Role, StaffRole>> = {
  [Role.REGENTE]:   StaffRole.REGENTE,
  [Role.SECRETARY]: StaffRole.SECRETARIA,
  [Role.PSICOLOGO]: StaffRole.PSICOLOGO,
  [Role.PORTERO]:   StaffRole.PORTERO,
  [Role.STAFF]:     StaffRole.OTRO,
}

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

  async createUser({ email, password, role, schoolId, districtId, nucleoId, firstName, lastName, ci, phone, shift }: CreateUserInput) {
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
    } else if (schoolId != null && ctx) {
      // Rol de alcance colegio (JUNTA_ESCOLAR, DIRECTOR, STUDENT_GOV, etc.):
      // si quien crea es de alcance núcleo/distrito, el colegio destino tiene
      // que pertenecer a su propio núcleo/distrito — mismo candado que ya
      // existe en junta.service.ts:updateJuntaMember, pero acá faltaba en el
      // alta (auditoría del panel Junta Núcleo/Distrito, hallazgo #3).
      if (NUCLEO_WIDE_ROLES.has(ctx.role) && ctx.nucleoId != null) {
        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { nucleoId: true } })
        if (!school || school.nucleoId !== ctx.nucleoId) {
          throw new HttpError(403, 'El colegio indicado no pertenece a tu núcleo')
        }
      } else if (DISTRICT_WIDE_ROLES.has(ctx.role) && ctx.districtId != null) {
        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { districtId: true } })
        if (!school || school.districtId !== ctx.districtId) {
          throw new HttpError(403, 'El colegio indicado no pertenece a tu distrito')
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const createdByUserId = ctx?.userId
    const userData = {
      email, password: hashedPassword, role, schoolId,
      districtId: resolvedDistrictId, nucleoId: resolvedNucleoId, createdByUserId,
    }

    const staffRole = STAFF_ROLE_BY_USER_ROLE[role]
    if (!staffRole) return userRepository.create(userData)

    if (!firstName?.trim() || !lastName?.trim()) {
      throw new HttpError(400, 'Nombre y apellido son requeridos para este rol — quedan registrados en el control de ingreso/salida de portería')
    }

    return prisma.$transaction(async (tx) => {
      const user = await userRepository.createTx(tx, userData)
      await staffRepository.createTx(tx, {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        ci:        ci    || null,
        phone:     phone || null,
        shift:     shift || null,
        staffRole,
        userId:    user.id,
        schoolId:  user.schoolId!,
      })
      return user
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

    // Nuevo desde que createUser empezó a crear el Staff vinculado (ver
    // STAFF_ROLE_BY_USER_ROLE): Staff_userId_fkey es RESTRICT, así que borrar
    // el User de alguien con Staff revienta esa constraint si no se maneja acá.
    const staff = await staffRepository.findByUserId(id)
    if (staff) {
      const activityCount = await staffRepository.countActivity(staff.id)
      if (activityCount > 0) {
        throw new HttpError(409, 'Este usuario tiene registros de portería (ingresos/salidas o huella/QR) asociados — no se puede eliminar directamente. Contactá soporte si necesitás depurar esos datos primero.')
      }
    }

    await userRepository.detachRelations(id)
    if (staff) {
      await prisma.$transaction(async (tx) => {
        await staffRepository.deleteTx(tx, staff.id)
        await userRepository.deleteTx(tx, id)
      })
    } else {
      await userRepository.delete(id)
    }
  },

  async getJuntaParents() {
    const juntaUsers = await userRepository.findJuntaParents()
    return juntaUsers.map((u) => u.parent).filter((p) => p !== null)
  },
}

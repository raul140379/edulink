import { Prisma, Role } from '@prisma/client'
import prisma from '../lib/prisma'
import { juntaRepository } from '../repositories/junta.repository'
import { userRepository } from '../repositories/user.repository'
import { userService } from './user.service'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CREATABLE_ROLES } from '../config/permissions'
import { DISTRICT_WIDE_ROLES, NUCLEO_WIDE_ROLES } from '../lib/scoped-models'
import { generateUniqueEmail, generateJuntaPassword } from '../utils/account-generator'
import {
  CreateJuntaMemberInput, UpdateJuntaMemberInput, UpdateOwnJuntaProfileInput,
} from '../schemas/junta.schema'

export const juntaService = {
  // El motor de tenant-scoping (lib/prisma.ts) ya filtra JuntaMember al alcance
  // de quien consulta (colegio/núcleo/distrito) — no hace falta scoping manual acá.
  listJuntaMembers() {
    return juntaRepository.findMany()
  },

  // Candado de cargo (no de rol): solo el Presidente de la Junta Escolar puede
  // gestionar el resto del directorio y los Delegados de su colegio. Se llama
  // desde el service (no un middleware) porque solo aplica cuando quien actúa
  // es JUNTA_ESCOLAR — Núcleo/Distrito no pasan por acá.
  async assertIsPresidente(userId: number) {
    const member = await juntaRepository.findByUserId(userId)
    if (!member?.isActive || member.juntaRole !== 'PRESIDENTE') {
      throw new HttpError(403, 'Solo el Presidente de la Junta Escolar puede realizar esta acción')
    }
  },

  async createJuntaMember(input: CreateJuntaMemberInput) {
    const ctx = getTenantContext()

    if (input.role === 'JUNTA_ESCOLAR') {
      // Ser miembro de Junta Escolar (cualquier cargo) exige ser ya un
      // Parent/tutor registrado en el sistema — no se tipean datos nuevos,
      // se elige un padre existente y se le genera una segunda cuenta
      // (mismo patrón que delegateService.assignDelegate).
      if (!input.parentId) throw new HttpError(400, 'Selecciona un padre/tutor ya registrado')

      if (ctx?.role === Role.JUNTA_ESCOLAR) {
        await this.assertIsPresidente(ctx.userId)
        if (input.cargo === 'PRESIDENTE') {
          throw new HttpError(403, 'No podés asignar el cargo de Presidente — esa reasignación es exclusiva de Junta de Núcleo/Distrito')
        }
      }

      // Para el Presidente, el colegio es siempre el propio — no hace falta
      // que el frontend lo mande. Núcleo/Distrito sí tienen que elegirlo
      // (cascada núcleo→colegio existente en junta/nueva).
      const targetSchoolId = input.schoolId ?? (ctx?.role === Role.JUNTA_ESCOLAR ? ctx.schoolId ?? undefined : undefined)
      if (!targetSchoolId) throw new HttpError(400, 'Selecciona un colegio')

      const parent = await juntaRepository.findEligibleParentForBoard(input.parentId, targetSchoolId)
      if (!parent) {
        throw new HttpError(400, 'Esta persona debe estar registrada como tutor de un estudiante del colegio antes de poder ser parte de la Junta Escolar')
      }

      const accessEmail    = await generateUniqueEmail(parent.firstName, parent.lastName)
      const defaultPassword = generateJuntaPassword(parent.lastName, parent.ci)

      // El núcleo no lo manda el cliente — se deriva del propio colegio, así
      // el JuntaMember/User quedan agrupables por núcleo desde el alta.
      const school = await prisma.school.findUnique({ where: { id: targetSchoolId }, select: { nucleoId: true } })

      const user = await userService.createUser({
        email:    accessEmail,
        password: defaultPassword,
        role:     Role.JUNTA_ESCOLAR,
        schoolId: targetSchoolId,
        nucleoId: school?.nucleoId ?? undefined,
      })

      const member = await juntaRepository.create({
        firstName:    parent.firstName,
        lastName:     parent.lastName,
        ci:           parent.ci,
        phone:        parent.phone,
        juntaRole:    input.cargo,
        academicYear: input.academicYear,
        userId:       user.id,
        parentId:     parent.id,
        schoolId:     user.schoolId ?? undefined,
        nucleoId:     user.nucleoId ?? undefined,
      })

      return { ...member, accessEmail, defaultPassword }
    }

    // ---- JUNTA_NUCLEO / JUNTA_DISTRITO: alta "en blanco" de siempre ----
    const user = await userService.createUser({
      email:    input.email!,
      password: input.password!,
      role:     input.role as unknown as Role,
      schoolId: input.schoolId,
      nucleoId: input.nucleoId,
    })

    return juntaRepository.create({
      firstName:    input.firstName!,
      lastName:     input.lastName!,
      ci:           input.ci || null,
      phone:        input.phone || null,
      juntaRole:    input.cargo,
      academicYear: input.academicYear,
      userId:       user.id,
      schoolId:     user.schoolId ?? undefined,
      nucleoId:     user.nucleoId ?? undefined,
      districtId:   user.districtId ?? undefined,
    })
  },

  async updateJuntaMember(id: number, input: UpdateJuntaMemberInput) {
    const existing = await juntaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Miembro de junta no encontrado')
    // El campo del schema/API se llama "cargo" (así lo espera el frontend), pero
    // en el modelo Prisma la columna es "juntaRole" — hay que traducirlo acá,
    // Prisma rechaza "cargo" como argumento desconocido si se pasa tal cual.
    const { cargo, role, schoolId, nucleoId, ...rest } = input
    const ctxForCargo = getTenantContext()

    // El Presidente de Junta Escolar puede editar al resto del directorio, pero
    // nunca puede auto-asignarse (ni asignarle a otro) el cargo de Presidente —
    // esa reasignación queda reservada para Junta de Núcleo/Distrito.
    if (ctxForCargo?.role === Role.JUNTA_ESCOLAR) {
      await this.assertIsPresidente(ctxForCargo.userId)
      if (cargo === 'PRESIDENTE') {
        throw new HttpError(403, 'No podés asignar el cargo de Presidente — esa reasignación es exclusiva de Junta de Núcleo/Distrito')
      }
    }

    const memberUpdate: Prisma.JuntaMemberUpdateInput = {
      ...rest,
      ...(cargo !== undefined ? { juntaRole: cargo } : {}),
    }

    // Reasignar nivel/alcance (rol y/o colegio/núcleo) solo se resuelve si el
    // body efectivamente toca alguno de estos 3 campos — no en cada edición de
    // nombre/CI/teléfono. Cubre tanto "cambiar de rol" (ej. Junta Escolar ->
    // Junta de Núcleo) como "mismo rol, mover de colegio/núcleo".
    if (role !== undefined || schoolId !== undefined || nucleoId !== undefined) {
      const targetRole = role ?? existing.user.role
      const ctx = getTenantContext()

      // Un Presidente de Junta Escolar solo gestiona su propio colegio — el
      // motor de tenant-scoping fuerza schoolId en creates pero no en updates,
      // así que acá hay que rechazar a mano un intento de mover a otro colegio.
      if (ctx?.role === Role.JUNTA_ESCOLAR && schoolId !== undefined && schoolId !== ctx.schoolId) {
        throw new HttpError(403, 'Solo podés gestionar miembros de tu propio colegio')
      }

      // Cambiar de rol exige la misma jerarquía de designación que al crear un
      // miembro nuevo (CREATABLE_ROLES) — quien edita no puede mover a alguien a
      // un nivel que tampoco podría asignar de cero.
      if (role !== undefined && role !== existing.user.role && ctx && ctx.role !== Role.SUPER_ADMIN) {
        const allowed = CREATABLE_ROLES[ctx.role]
        if (!allowed || !allowed.includes(role)) {
          throw new HttpError(403, `Tu rol no tiene permitido asignar el rol ${role}`)
        }
      }

      let resolvedSchoolId: number | null = null
      let resolvedNucleoId: number | null = null
      let resolvedDistrictId: number | null = null

      if (targetRole === 'JUNTA_ESCOLAR') {
        if (!schoolId) throw new HttpError(400, 'Selecciona un colegio para Junta Escolar')
        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { districtId: true, nucleoId: true } })
        if (!school) throw new HttpError(404, 'Colegio no encontrado')
        // El motor de tenant-scoping (lib/prisma.ts) solo valida el schoolId en
        // creates/upserts, no en updates — acá hay que repetir el mismo chequeo
        // a mano para no dejar que un Junta de Núcleo/Distrito reasigne a un
        // colegio fuera de su alcance.
        if (ctx?.nucleoId != null && NUCLEO_WIDE_ROLES.has(ctx.role) && school.nucleoId !== ctx.nucleoId) {
          throw new HttpError(403, 'El colegio indicado no pertenece a tu núcleo')
        }
        if (ctx?.districtId != null && DISTRICT_WIDE_ROLES.has(ctx.role) && school.districtId !== ctx.districtId) {
          throw new HttpError(403, 'El colegio indicado no pertenece a tu distrito')
        }
        resolvedSchoolId = schoolId
        resolvedNucleoId = school.nucleoId ?? null
      } else if (targetRole === 'JUNTA_NUCLEO') {
        const targetNucleoId = nucleoId ?? existing.nucleoId
        if (!targetNucleoId) throw new HttpError(400, 'Selecciona un núcleo')
        const nucleo = await prisma.nucleo.findUnique({ where: { id: targetNucleoId }, select: { districtId: true } })
        if (!nucleo) throw new HttpError(404, 'Núcleo no encontrado')
        if (ctx?.districtId != null && DISTRICT_WIDE_ROLES.has(ctx.role) && nucleo.districtId !== ctx.districtId) {
          throw new HttpError(403, 'El núcleo indicado no pertenece a tu distrito')
        }
        resolvedNucleoId = targetNucleoId
      } else if (targetRole === 'JUNTA_DISTRITO') {
        resolvedDistrictId = ctx?.districtId ?? existing.districtId ?? null
      }

      await userRepository.update(existing.userId, {
        ...(role !== undefined ? { role: role as unknown as Role } : {}),
        schoolId:   resolvedSchoolId,
        nucleoId:   resolvedNucleoId,
        districtId: resolvedDistrictId,
      })

      memberUpdate.school   = resolvedSchoolId   != null ? { connect: { id: resolvedSchoolId } }   : { disconnect: true }
      memberUpdate.nucleo   = resolvedNucleoId   != null ? { connect: { id: resolvedNucleoId } }   : { disconnect: true }
      memberUpdate.district = resolvedDistrictId != null ? { connect: { id: resolvedDistrictId } } : { disconnect: true }
    }

    return juntaRepository.update(id, memberUpdate)
  },

  // Baja reversible: desactiva el JuntaMember Y el User que lo respalda (si no se
  // toca el User, la persona podría seguir iniciando sesión aunque su perfil de
  // junta figure inactivo). El motor de tenant-scoping ya resuelve el 404 si el
  // miembro está fuera del alcance de quien llama (distrito/núcleo).
  async toggleJuntaMemberStatus(id: number, requesterId: number) {
    const existing = await juntaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Miembro de junta no encontrado')
    if (existing.userId === requesterId) {
      throw new HttpError(400, 'No podés desactivar tu propia cuenta desde acá')
    }
    const ctx = getTenantContext()
    if (ctx?.role === Role.JUNTA_ESCOLAR) await this.assertIsPresidente(ctx.userId)
    const next = !existing.isActive
    await juntaRepository.update(id, { isActive: next })
    await userRepository.setActive(existing.userId, next)
    return next
  },

  async getOwnProfile(userId: number) {
    const member = await juntaRepository.findByUserId(userId)
    if (!member) throw new HttpError(404, 'No se encontró un perfil de junta para este usuario')
    return member
  },

  async updateOwnProfile(userId: number, input: UpdateOwnJuntaProfileInput) {
    const member = await juntaRepository.findByUserId(userId)
    if (!member) throw new HttpError(404, 'No se encontró un perfil de junta para este usuario')
    try {
      return await juntaRepository.update(member.id, input)
    } catch (error: any) {
      if (error?.code === 'P2002') throw new HttpError(409, 'Ese CI ya está registrado')
      throw error
    }
  },
}

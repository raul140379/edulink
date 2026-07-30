import { Role } from '@prisma/client'
import prisma from '../lib/prisma'
import { juntaRepository } from '../repositories/junta.repository'
import { userRepository } from '../repositories/user.repository'
import { userService } from './user.service'
import { HttpError } from '../utils/http-error'
import {
  CreateJuntaMemberInput, UpdateJuntaMemberInput, UpdateOwnJuntaProfileInput,
} from '../schemas/junta.schema'

export const juntaService = {
  // El motor de tenant-scoping (lib/prisma.ts) ya filtra JuntaMember al alcance
  // de quien consulta (colegio/núcleo/distrito) — no hace falta scoping manual acá.
  listJuntaMembers() {
    return juntaRepository.findMany()
  },

  async createJuntaMember(input: CreateJuntaMemberInput) {
    // Para JUNTA_ESCOLAR el núcleo no lo manda el cliente — se deriva del propio
    // colegio, así el JuntaMember/User quedan agrupables por núcleo desde el alta
    // (antes quedaban con nucleoId null aunque su colegio sí tuviera núcleo).
    let nucleoId = input.nucleoId
    if (input.role === 'JUNTA_ESCOLAR' && input.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: input.schoolId }, select: { nucleoId: true } })
      if (school?.nucleoId != null) nucleoId = school.nucleoId
    }

    // Crea primero el User (valida jerarquía CREATABLE_ROLES y resuelve el
    // alcance schoolId/nucleoId/districtId según el rol — ver user.service.ts).
    const user = await userService.createUser({
      email:    input.email,
      password: input.password,
      role:     input.role as unknown as Role,
      schoolId: input.schoolId,
      nucleoId,
    })

    return juntaRepository.create({
      firstName:    input.firstName,
      lastName:     input.lastName,
      ci:           input.ci || null,
      phone:        input.phone || null,
      juntaRole:    input.cargo,
      academicYear: input.academicYear,
      user:         { connect: { id: user.id } },
      ...(user.schoolId   != null ? { school:   { connect: { id: user.schoolId } } }   : {}),
      ...(user.nucleoId   != null ? { nucleo:   { connect: { id: user.nucleoId } } }   : {}),
      ...(user.districtId != null ? { district: { connect: { id: user.districtId } } } : {}),
    })
  },

  async updateJuntaMember(id: number, input: UpdateJuntaMemberInput) {
    const existing = await juntaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Miembro de junta no encontrado')
    // El campo del schema/API se llama "cargo" (así lo espera el frontend), pero
    // en el modelo Prisma la columna es "juntaRole" — hay que traducirlo acá,
    // Prisma rechaza "cargo" como argumento desconocido si se pasa tal cual.
    const { cargo, ...rest } = input
    return juntaRepository.update(id, { ...rest, ...(cargo !== undefined ? { juntaRole: cargo } : {}) })
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

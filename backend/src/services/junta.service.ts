import { Role } from '@prisma/client'
import { juntaRepository } from '../repositories/junta.repository'
import { userService } from './user.service'
import { HttpError } from '../utils/http-error'
import { CreateJuntaMemberInput, UpdateJuntaMemberInput } from '../schemas/junta.schema'

export const juntaService = {
  // El motor de tenant-scoping (lib/prisma.ts) ya filtra JuntaMember al alcance
  // de quien consulta (colegio/núcleo/distrito) — no hace falta scoping manual acá.
  listJuntaMembers() {
    return juntaRepository.findMany()
  },

  async createJuntaMember(input: CreateJuntaMemberInput) {
    // Crea primero el User (valida jerarquía CREATABLE_ROLES y resuelve el
    // alcance schoolId/nucleoId/districtId según el rol — ver user.service.ts).
    const user = await userService.createUser({
      email:    input.email,
      password: input.password,
      role:     input.role as unknown as Role,
      schoolId: input.schoolId,
      nucleoId: input.nucleoId,
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
    return juntaRepository.update(id, input)
  },
}

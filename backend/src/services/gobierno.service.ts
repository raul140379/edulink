import { Role } from '@prisma/client'
import { gobiernoRepository } from '../repositories/gobierno.repository'
import { userService } from './user.service'
import { HttpError } from '../utils/http-error'
import { CreateGobiernoMemberInput, UpdateGobiernoMemberInput } from '../schemas/gobierno.schema'

export const gobiernoService = {
  // El motor de tenant-scoping (lib/prisma.ts) ya filtra GobiernoMember al alcance
  // de quien consulta (colegio/núcleo/distrito) — no hace falta scoping manual acá.
  listGobiernoMembers() {
    return gobiernoRepository.findMany()
  },

  async createGobiernoMember(input: CreateGobiernoMemberInput) {
    // Crea primero el User (valida jerarquía CREATABLE_ROLES y resuelve el
    // alcance schoolId/nucleoId/districtId según el rol — ver user.service.ts).
    const user = await userService.createUser({
      email:    input.email,
      password: input.password,
      role:     input.role as unknown as Role,
      schoolId: input.schoolId,
      nucleoId: input.nucleoId,
    })

    return gobiernoRepository.create({
      firstName:    input.firstName,
      lastName:     input.lastName,
      ci:           input.ci || null,
      phone:        input.phone || null,
      cargo:        input.cargo,
      academicYear: input.academicYear,
      user:         { connect: { id: user.id } },
      ...(user.schoolId   != null ? { school:   { connect: { id: user.schoolId } } }   : {}),
      ...(user.nucleoId   != null ? { nucleo:   { connect: { id: user.nucleoId } } }   : {}),
      ...(user.districtId != null ? { district: { connect: { id: user.districtId } } } : {}),
    })
  },

  async updateGobiernoMember(id: number, input: UpdateGobiernoMemberInput) {
    const existing = await gobiernoRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Miembro de gobierno estudiantil no encontrado')
    return gobiernoRepository.update(id, input)
  },
}

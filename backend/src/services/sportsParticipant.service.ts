import { sportsParticipantRepository } from '../repositories/sportsParticipant.repository'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { CreateSportsParticipantInput } from '../schemas/sportsParticipant.schema'

export const sportsParticipantService = {
  async listParticipants() {
    const activeYear = await sportsParticipantRepository.findActiveAcademicYear()
    if (!activeYear) return []

    const rows = await sportsParticipantRepository.findMany(activeYear.id)
    return rows.map((r) => ({
      id: r.id,
      discipline: r.discipline,
      modality: r.modality,
      createdAt: r.createdAt,
      student: {
        id: r.student.id,
        fullName: `${r.student.lastName} ${r.student.firstName}`,
        ci: r.student.ci,
        rude: r.student.rude,
        birthDate: r.student.birthDate,
        course: r.student.assignments[0]?.course
          ? { grade: r.student.assignments[0].course.grade, parallel: r.student.assignments[0].course.parallel }
          : null,
      },
    }))
  },

  async registerParticipants(input: CreateSportsParticipantInput, userId: number | undefined) {
    const activeYear = await sportsParticipantRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    // schoolId explícito para satisfacer el tipo de Prisma — el motor de
    // tenant-scoping igual lo fuerza/valida en cada fila al escribir.
    const schoolId = getTenantContext()?.schoolId ?? 0

    const rows = input.studentIds.map((studentId) => ({
      studentId,
      discipline: input.discipline,
      modality: input.modality ?? null,
      academicYearId: activeYear.id,
      schoolId,
      createdById: userId,
    }))

    const result = await sportsParticipantRepository.createMany(rows)
    const skipped = input.studentIds.length - result.count
    return {
      message: skipped > 0
        ? `${result.count} de ${input.studentIds.length} agregado(s) a ${input.discipline} — ${skipped} ya estaba(n) registrado(s) en esa disciplina`
        : `${result.count} estudiante(s) agregado(s) a ${input.discipline}`,
      created: result.count,
      skipped,
    }
  },

  async removeParticipant(id: number) {
    const existing = await sportsParticipantRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Registro no encontrado')
    await sportsParticipantRepository.delete(id)
  },
}

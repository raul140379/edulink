import { Role } from '@prisma/client'
import { convocatoriaRepository } from '../repositories/convocatoria.repository'
import { treasuryRepository } from '../repositories/treasury.repository'
import { juntaService } from './junta.service'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import {
  CreateConvocatoriaInput, UpdateConvocatoriaInput, UpdateConvocatoriaAttendanceInput,
} from '../schemas/convocatoria.schema'

// "El Presidente debe poder convocar" — igual que con el directorio/delegados,
// gestionar convocatorias (crear/editar/cancelar/tomar asistencia/cerrar) es
// exclusivo del Presidente; el resto de la Junta Escolar solo puede consultar
// (listConvocatorias/getById quedan sin este candado).
async function assertCanManage() {
  const ctx = getTenantContext()
  if (ctx?.role === Role.JUNTA_ESCOLAR) await juntaService.assertIsPresidente(ctx.userId)
}

async function resolveAudienceUserIds(schoolId: number, audience: string): Promise<number[]> {
  if (audience === 'DELEGADOS') {
    const rows = await convocatoriaRepository.findDelegateUserIds(schoolId)
    return rows.map((r) => r.delegateUserId!).filter((id): id is number => id != null)
  }
  if (audience === 'DIRECTORIO') {
    const rows = await convocatoriaRepository.findDirectorioUserIds(schoolId)
    return rows.map((r) => r.userId)
  }
  // TODOS_LOS_PADRES
  const rows = await convocatoriaRepository.findAllParentUserIds(schoolId)
  return rows.map((r) => r.userId!).filter((id): id is number => id != null)
}

export const convocatoriaService = {
  listConvocatorias() {
    return convocatoriaRepository.findMany()
  },

  async getById(id: number) {
    const convocatoria = await convocatoriaRepository.findById(id)
    if (!convocatoria) throw new HttpError(404, 'Convocatoria no encontrada')
    return convocatoria
  },

  async createConvocatoria(userId: number, input: CreateConvocatoriaInput) {
    await assertCanManage()
    const ctx = getTenantContext()
    const schoolId = ctx?.schoolId ?? 0

    const userIds = await resolveAudienceUserIds(schoolId, input.audience)

    return convocatoriaRepository.create({
      title:       input.title,
      description: input.description || null,
      kind:        input.kind,
      audience:    input.audience,
      date:        new Date(input.date),
      location:    input.location || null,
      multaAmount: input.multaAmount ?? null,
      createdById: userId,
      userIds,
    })
  },

  async updateConvocatoria(id: number, input: UpdateConvocatoriaInput) {
    await assertCanManage()
    const existing = await convocatoriaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Convocatoria no encontrada')
    if (existing.isClosed) throw new HttpError(400, 'Esta convocatoria ya está cerrada')

    return convocatoriaRepository.update(id, {
      ...(input.title       !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.date        !== undefined ? { date: new Date(input.date) } : {}),
      ...(input.location    !== undefined ? { location: input.location || null } : {}),
      ...(input.multaAmount !== undefined ? { multaAmount: input.multaAmount } : {}),
    })
  },

  async cancelConvocatoria(id: number) {
    await assertCanManage()
    const existing = await convocatoriaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Convocatoria no encontrada')
    if (existing.isClosed) throw new HttpError(400, 'Esta convocatoria ya está cerrada')
    await convocatoriaRepository.setCancelled(id, true)
  },

  async updateAttendance(id: number, input: UpdateConvocatoriaAttendanceInput) {
    await assertCanManage()
    const existing = await convocatoriaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Convocatoria no encontrada')
    if (existing.isClosed) throw new HttpError(400, 'Esta convocatoria ya está cerrada — no se puede modificar la asistencia')

    await Promise.all(
      input.attendances.map((a) => convocatoriaRepository.updateAttendance(id, a.userId, a.present, a.note))
    )
  },

  // Cierra la convocatoria y, si tiene multaAmount definido, genera
  // automáticamente el cargo MULTA_ASAMBLEA a cada ausente que resuelva a un
  // Parent — quien no resuelve (directivo sin padre vinculado, dato legado)
  // se salta y se reporta, sin romper el cierre.
  async closeConvocatoria(id: number, academicYearId: number) {
    await assertCanManage()
    const existing = await convocatoriaRepository.findById(id)
    if (!existing) throw new HttpError(404, 'Convocatoria no encontrada')
    if (existing.isClosed) throw new HttpError(400, 'Esta convocatoria ya está cerrada')

    const absentes = existing.attendances.filter((a) => !a.present && !a.charged)

    let charged = 0
    const skipped: { userId: number; name: string; reason: string }[] = []
    const chargedAttendanceIds: number[] = []

    if (existing.multaAmount != null) {
      for (const attendance of absentes) {
        const parent = await convocatoriaRepository.findParentByUserId(attendance.userId)
        if (!parent) {
          skipped.push({ userId: attendance.userId, name: attendance.user.email, reason: 'Sin registro de padre/tutor vinculado' })
          continue
        }

        await treasuryRepository.createChargeRaw({
          title: `Multa por inasistencia: ${existing.title}`,
          description: `Ausente en convocatoria del ${new Date(existing.date).toLocaleDateString('es-BO')}`,
          amount: existing.multaAmount,
          type: 'MULTA_ASAMBLEA',
          target: 'TUTOR',
          parentId: parent.id,
          academicYearId,
          schoolId: existing.schoolId,
        })
        charged++
        chargedAttendanceIds.push(attendance.id)
      }
      if (chargedAttendanceIds.length > 0) await convocatoriaRepository.markAttendanceCharged(chargedAttendanceIds)
    }

    await convocatoriaRepository.setClosed(id)

    return { charged, skipped }
  },
}

import { z } from 'zod'
import { SportsCategory, SportsRole } from '@prisma/client'

export const createSportsParticipantSchema = z.object({
  studentIds:   z.array(z.number().int().positive()).min(1, 'Seleccioná al menos un estudiante'),
  discipline:   z.string().trim().min(1, 'La disciplina es obligatoria').max(100),
  modality:     z.enum(['INDIVIDUAL', 'GRUPAL']).optional(),
  categoria:    z.nativeEnum(SportsCategory),
  // Exclusivos del formato Sub-14 (la planilla Sub-19 no los tiene) — se
  // ignoran/quedan null si no vienen, nunca se exigen a nivel de schema.
  rolFuncion:   z.nativeEnum(SportsRole).optional(),
  contactPhone: z.string().trim().max(30).optional(),
})

export type CreateSportsParticipantInput = z.infer<typeof createSportsParticipantSchema>

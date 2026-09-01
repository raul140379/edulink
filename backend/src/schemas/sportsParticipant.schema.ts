import { z } from 'zod'

// Lista curada para el <select> del frontend — no se fuerza acá como enum: la
// disciplina queda como texto libre en el backend a propósito, para no
// necesitar una migración cada vez que cambie la lista de un año a otro (el
// frontend igual ofrece "Otro (especificar)" con texto libre).
export const DISCIPLINES = [
  'Fútbol', 'Atletismo', 'Básquet', 'Vóley',
  'Ajedrez', 'Tenis de Mesa', 'Judo / Defensa Personal', 'Natación',
] as const

export const createSportsParticipantSchema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1, 'Seleccioná al menos un estudiante'),
  discipline: z.string().trim().min(1, 'La disciplina es obligatoria').max(100),
  modality:   z.enum(['INDIVIDUAL', 'GRUPAL']).optional(),
})

export type CreateSportsParticipantInput = z.infer<typeof createSportsParticipantSchema>

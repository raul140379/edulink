import { z } from 'zod'

export const createNucleoSchema = z.object({
  name:     z.string().min(1, 'El nombre del núcleo es requerido'),
  location: z.string().optional(),
})

export const updateNucleoSchema = z.object({
  name:     z.string().min(1).optional(),
  location: z.string().optional(),
})

export type CreateNucleoInput = z.infer<typeof createNucleoSchema>
export type UpdateNucleoInput = z.infer<typeof updateNucleoSchema>

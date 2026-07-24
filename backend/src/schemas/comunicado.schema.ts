import { z } from 'zod'

export const createComunicadoSchema = z.object({
  title:    z.string().min(1, 'El título es requerido'),
  body:     z.string().min(1, 'El contenido es requerido'),
  type:     z.enum(['COMUNICADO', 'CONVOCATORIA', 'AVISO']).default('COMUNICADO'),
  imageUrl: z.string().optional(),
})

export const updateComunicadoSchema = z.object({
  title:       z.string().min(1).optional(),
  body:        z.string().min(1).optional(),
  type:        z.enum(['COMUNICADO', 'CONVOCATORIA', 'AVISO']).optional(),
  imageUrl:    z.string().optional(),
  isPublished: z.boolean().optional(),
})

export type CreateComunicadoInput = z.infer<typeof createComunicadoSchema>
export type UpdateComunicadoInput = z.infer<typeof updateComunicadoSchema>

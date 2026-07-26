import { z } from 'zod'

export const updateDistrictSchema = z.object({
  name:        z.string().min(1, 'El nombre del distrito es requerido').optional(),
  location:    z.string().optional(),
  emailDomain: z.string()
    .regex(/^@[a-z0-9.-]+\.[a-z]{2,}$/i, 'El dominio debe tener el formato @colegio.edu.bo')
    .optional(),
})

export type UpdateDistrictInput = z.infer<typeof updateDistrictSchema>

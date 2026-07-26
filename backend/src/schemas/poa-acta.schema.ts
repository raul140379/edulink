import { z } from 'zod'

export const upsertPoaActaSchema = z.object({
  academicYear:    z.coerce.number().int(),
  assemblyDate:    z.string(),
  montoGlobal:     z.coerce.number(),
  montoIndividual: z.coerce.number().optional(),
  items:           z.string().min(1, 'Detalla los ítems del POA'),
})

export type UpsertPoaActaInput = z.infer<typeof upsertPoaActaSchema>

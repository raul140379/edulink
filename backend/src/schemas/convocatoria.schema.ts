import { z } from 'zod'

export const convocatoriaKindSchema     = z.enum(['ORDINARIA', 'EMERGENCIA', 'ACTIVIDAD'])
export const convocatoriaAudienceSchema = z.enum(['DELEGADOS', 'DIRECTORIO', 'TODOS_LOS_PADRES'])

export const createConvocatoriaSchema = z.object({
  title:       z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  kind:        convocatoriaKindSchema.default('ORDINARIA'),
  audience:    convocatoriaAudienceSchema,
  date:        z.string().min(1, 'La fecha es requerida'),
  location:    z.string().optional(),
  // Monto de la multa por inasistencia — se define acá para que el cobro al
  // cerrar la convocatoria sea automático, sin pedirlo de nuevo.
  multaAmount: z.coerce.number().positive().optional(),
})

export const updateConvocatoriaSchema = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().optional(),
  date:        z.string().optional(),
  location:    z.string().optional(),
  multaAmount: z.coerce.number().positive().optional(),
})

export const convocatoriaAttendanceItemSchema = z.object({
  userId:  z.coerce.number().int(),
  present: z.boolean(),
  note:    z.string().optional(),
})

export const updateConvocatoriaAttendanceSchema = z.object({
  attendances: z.array(convocatoriaAttendanceItemSchema).min(1, 'Datos de asistencia requeridos'),
})

export const closeConvocatoriaSchema = z.object({
  // Requerido para poder generar los cargos de multa al cerrar (si la
  // convocatoria no trae multaAmount definido, se exige acá).
  academicYearId: z.coerce.number().int(),
})

export type CreateConvocatoriaInput           = z.infer<typeof createConvocatoriaSchema>
export type UpdateConvocatoriaInput           = z.infer<typeof updateConvocatoriaSchema>
export type UpdateConvocatoriaAttendanceInput = z.infer<typeof updateConvocatoriaAttendanceSchema>
export type CloseConvocatoriaInput            = z.infer<typeof closeConvocatoriaSchema>

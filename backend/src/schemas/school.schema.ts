import { z } from 'zod'

const LEVELS = z.array(z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA'])).min(1, 'Selecciona al menos un nivel')
const SHIFTS = z.array(z.enum(['MORNING', 'AFTERNOON', 'NIGHT'])).min(1, 'Selecciona al menos un turno')

export const createSchoolSchema = z.object({
  name:       z.string().min(1, 'El nombre de la unidad educativa es requerido'),
  sieCode:    z.string().min(1, 'El código SIE es requerido'),
  tipo:       z.enum(['FISCAL', 'CONVENIO', 'PRIVADA']),
  area:       z.enum(['URBANA', 'RURAL']),
  subsistema: z.enum(['REGULAR', 'ALTERNATIVA_ESPECIAL', 'SUPERIOR_FORMACION_PROFESIONAL']).optional(),
  levels:     LEVELS,
  offersBTH:  z.boolean().optional(),
  shifts:     SHIFTS,
  address:    z.string().optional(),
  districtId: z.coerce.number().int().optional(),
  nucleoId:   z.coerce.number().int().nullable().optional(),
})

export const updateSchoolSchema = z.object({
  name:       z.string().min(1).optional(),
  sieCode:    z.string().min(1).optional(),
  tipo:       z.enum(['FISCAL', 'CONVENIO', 'PRIVADA']).optional(),
  area:       z.enum(['URBANA', 'RURAL']).optional(),
  subsistema: z.enum(['REGULAR', 'ALTERNATIVA_ESPECIAL', 'SUPERIOR_FORMACION_PROFESIONAL']).optional(),
  levels:     LEVELS.optional(),
  offersBTH:  z.boolean().optional(),
  shifts:     SHIFTS.optional(),
  address:    z.string().optional(),
  isActive:   z.boolean().optional(),
  nucleoId:   z.coerce.number().int().nullable().optional(),
})

export const assignDirectorSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName:  z.string().min(1, 'El apellido es requerido'),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Correo inválido').optional().or(z.literal('')),
  password:  z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type CreateSchoolInput    = z.infer<typeof createSchoolSchema>
export type UpdateSchoolInput    = z.infer<typeof updateSchoolSchema>
export type AssignDirectorInput  = z.infer<typeof assignDirectorSchema>

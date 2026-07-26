import { z } from 'zod'

// Los 3 niveles de Gobierno Estudiantil que este endpoint puede crear — STUDENT_GOV
// (colegio) ya existía como rol; GOBIERNO_NUCLEO/GOBIERNO_DISTRITO son nuevos.
export const gobiernoRoleLevelSchema = z.enum(['STUDENT_GOV', 'GOBIERNO_NUCLEO', 'GOBIERNO_DISTRITO'])
export const gobiernoCargoSchema = z.enum(['PRESIDENTE', 'VICEPRESIDENTE', 'SECRETARIA', 'TESORERO', 'VOCAL'])

export const createGobiernoMemberSchema = z.object({
  email:        z.string().email('Email inválido'),
  password:     z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role:         gobiernoRoleLevelSchema,
  // Requerido según el rol: schoolId para STUDENT_GOV, nucleoId para GOBIERNO_NUCLEO.
  // GOBIERNO_DISTRITO no necesita ninguno (hereda el distrito de quien lo crea).
  schoolId:     z.coerce.number().int().optional(),
  nucleoId:     z.coerce.number().int().optional(),
  firstName:    z.string().min(1, 'El nombre es requerido'),
  lastName:     z.string().min(1, 'El apellido es requerido'),
  ci:           z.string().optional(),
  phone:        z.string().optional(),
  cargo:        gobiernoCargoSchema.default('VOCAL'),
  academicYear: z.coerce.number().int(),
})

export const updateGobiernoMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  cargo:     gobiernoCargoSchema.optional(),
  isActive:  z.boolean().optional(),
})

export type CreateGobiernoMemberInput = z.infer<typeof createGobiernoMemberSchema>
export type UpdateGobiernoMemberInput = z.infer<typeof updateGobiernoMemberSchema>
